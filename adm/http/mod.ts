import { Application, Router } from "jsr:@oak/oak";
import { parse } from "jsr:@std/yaml";
import { registry, httpRequests } from "../metrics.ts";
import { createJobRun, getJobRun } from "../db/mod.ts";
import { queueJob } from "../jobs/client.ts";

const JOBSCHEDULE_PATH = new URL("../jobschedule.yml", import.meta.url).pathname;

// Remove all local metric definitions and registry setup

const router = new Router();

router.get("/schedule", async (ctx) => {
  try {
    const yamlText = await Deno.readTextFile(JOBSCHEDULE_PATH);
    const jobs = parse(yamlText);
    ctx.response.status = 200;
    ctx.response.body = Array.isArray(jobs) ? jobs : { jobs };
  } catch (err) {
    ctx.response.status = 500;
    const msg = err instanceof Error ? err.message : String(err);
    ctx.response.body = { error: "Failed to read schedule", details: msg };
  }
});

// /metrics endpoint for Prometheus
router.get("/metrics", async (ctx) => {
  ctx.response.status = 200;
  ctx.response.type = "text/plain";
  ctx.response.body = await registry.metrics();
});

// GET /runs/:id endpoint
router.get("/runs/:id", async (ctx) => {
  const id = ctx.params.id;
  if (!id) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Missing id param" };
    return;
  }
  try {
    const run = await getJobRun(id);
    if (!run) {
      ctx.response.status = 404;
      ctx.response.body = { error: "Run not found" };
    } else {
      ctx.response.status = 200;
      ctx.response.body = run;
    }
  } catch (err) {
    ctx.response.status = 500;
    const msg = err instanceof Error ? err.message : String(err);
    ctx.response.body = { error: "Failed to fetch run", details: msg };
  }
});

// --- Job queue and concurrency control ---
// Remove all job queue and concurrency logic from here
// --- End job queue ---

// POST /jobs/:jobname/run endpoint
router.post("/jobs/:jobname/run", async (ctx) => {
  const jobname = ctx.params.jobname;
  if (!jobname) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Missing jobname param" };
    return;
  }
  let runId: string;
  try {
    runId = await createJobRun(jobname);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to create job run", details: msg };
    return;
  }
  // Only call queueJob from jobs/client
  const accepted = queueJob(jobname, runId);
  if (!accepted) {
    ctx.response.status = 429;
    ctx.response.body = { error: "Too many jobs running or queued. Please try again later." };
    return;
  }
  ctx.response.status = 202;
  ctx.response.body = { runId, status: "pending" };
});

const app = new Application();

// Prometheus metrics middleware
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  const { method, url } = ctx.request;
  const status = ctx.response.status?.toString() || "0";
  // Use the first segment of the path as action, or full path
  const action = url.pathname.split("/")[1] || "/";
  httpRequests.labels({ method, action: `/${action}`, status }).inc();
  console.log(`${method} ${url.pathname} -> ${status} (${ms}ms)`);
});

app.use(router.routes());
app.use(router.allowedMethods());

export default app;