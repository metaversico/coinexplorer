import { Hono } from "hono";
import { parse } from "jsr:@std/yaml";
import { registry, httpRequests } from "../metrics.ts";
import { createJobRun, getJobRun } from "@coinexplorer/db";
import { queueJob } from "../jobs/client.ts";

const JOBSCHEDULE_PATH = new URL("../jobschedule.yml", import.meta.url).pathname;

const app = new Hono();

app.get("/schedule", async (c) => {
  try {
    const yamlText = await Deno.readTextFile(JOBSCHEDULE_PATH);
    const jobs = parse(yamlText);
    return c.json(Array.isArray(jobs) ? jobs : { jobs });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: "Failed to read schedule", details: msg }, 500);
  }
});

// /metrics endpoint for Prometheus
app.get("/metrics", async (c) => {
  const metrics = await registry.metrics();
  return c.text(metrics);
});

// GET /runs/:id endpoint
app.get("/runs/:id", async (c) => {
  const id = c.req.param("id");
  if (!id) {
    return c.json({ error: "Missing id param" }, 400);
  }
  try {
    const run = await getJobRun(id);
    if (!run) {
      return c.json({ error: "Run not found" }, 404);
    } else {
      return c.json(run);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: "Failed to fetch run", details: msg }, 500);
  }
});

// --- Job queue and concurrency control ---
// Remove all job queue and concurrency logic from here
// --- End job queue ---

// POST /jobs/:jobname/run endpoint
app.post("/jobs/:jobname/run", async (c) => {
  const jobname = c.req.param("jobname");
  if (!jobname) {
    return c.json({ error: "Missing jobname param" }, 400);
  }
  let runId: string;
  try {
    runId = await createJobRun(jobname);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: "Failed to create job run", details: msg }, 500);
  }
  // Only call queueJob from jobs/client
  const accepted = queueJob(jobname, runId);
  if (!accepted) {
    return c.json({ error: "Too many jobs running or queued. Please try again later." }, 429);
  }
  return c.json({ runId, status: "pending" }, 202);
});

function logHttpEvent({
  level,
  message,
  method,
  url,
  status,
  duration,
  origin = "http",
  extra = {},
}: {
  level: "info" | "error";
  message: string;
  method?: string;
  url?: string;
  status?: number | string;
  duration?: number;
  origin?: string;
  extra?: Record<string, unknown>;
}) {
  const log = {
    timestamp: new Date().toISOString(),
    level,
    origin,
    message,
    method,
    url,
    status,
    duration,
    ...extra,
  };
  console.log(JSON.stringify(log));
}

// Prometheus metrics middleware
app.use("*", async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  const method = c.req.method;
  const url = new URL(c.req.url);
  const status = c.res.status.toString();
  // Use the first segment of the path as action, or full path
  const action = url.pathname.split("/")[1] || "/";
  httpRequests.labels({ method, action: `/${action}`, status }).inc();
  logHttpEvent({
    level: "info",
    message: "HTTP request",
    method,
    url: url.pathname,
    status,
    duration: ms,
  });
});

export default app;