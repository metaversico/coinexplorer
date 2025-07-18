import { Application, Router } from "jsr:@oak/oak";
import { parse } from "jsr:@std/yaml";
import { Counter, Registry } from "@prom-client";
import { createJobRun, getJobRun, updateJobRun } from "../db/mod.ts";

const JOBSCHEDULE_PATH = new URL("../jobschedule.yml", import.meta.url).pathname;

// Prometheus metrics setup
const httpRequests = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "action", "status"],
});
const runningJobsGauge = new (await import("@prom-client")).Gauge({
  name: "adm_jobs_running",
  help: "Current number of running jobs",
});
const queuedJobsGauge = new (await import("@prom-client")).Gauge({
  name: "adm_jobs_queued",
  help: "Current number of queued jobs",
});
const jobsDroppedCounter = new (await import("@prom-client")).Counter({
  name: "adm_jobs_dropped_total",
  help: "Total number of jobs dropped due to full queue",
});
const jobsRunCounter = new (await import("@prom-client")).Counter({
  name: "adm_jobs_run_total",
  help: "Total number of jobs run by job name",
  labelNames: ["jobname"],
});
const jobsDurationHistogram = new (await import("@prom-client")).Histogram({
  name: "adm_job_duration_seconds",
  help: "Job duration in seconds by job name",
  labelNames: ["jobname"],
  buckets: [0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600],
});

const registry = new Registry();
registry.registerMetric(httpRequests);
registry.registerMetric(runningJobsGauge);
registry.registerMetric(queuedJobsGauge);
registry.registerMetric(jobsDroppedCounter);
registry.registerMetric(jobsRunCounter);
registry.registerMetric(jobsDurationHistogram);

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
const MAX_JOBS_RUNNING = parseInt(Deno.env.get("MAX_JOBS_RUNNING") ?? "20", 10);
const MAX_JOBS_QUEUED = parseInt(Deno.env.get("MAX_JOBS_QUEUED") ?? "50", 10);
let runningJobs = 0;
const jobQueue: Array<{ startJob: () => void; runId: string }> = [];

function tryStartJob(startJob: () => void, runId: string) {
  runningJobsGauge.set(runningJobs);
  queuedJobsGauge.set(jobQueue.length);
  if (runningJobs < MAX_JOBS_RUNNING) {
    runningJobs++;
    runningJobsGauge.set(runningJobs);
    updateJobRun(runId, { status: "pending" });
    startJob();
  } else if (jobQueue.length < MAX_JOBS_QUEUED) {
    jobQueue.push({ startJob, runId });
    queuedJobsGauge.set(jobQueue.length);
    updateJobRun(runId, { status: "queued" });
  } else {
    jobsDroppedCounter.inc();
    return false;
  }
  return true;
}

function onJobFinish() {
  runningJobs = Math.max(0, runningJobs - 1);
  runningJobsGauge.set(runningJobs);
  if (jobQueue.length > 0) {
    const next = jobQueue.shift();
    queuedJobsGauge.set(jobQueue.length);
    if (next) {
      runningJobs++;
      runningJobsGauge.set(runningJobs);
      updateJobRun(next.runId, { status: "pending" });
      next.startJob();
    }
  }
}
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
  // Job queue logic
  const startJob = () => {
    const start = Date.now();
    try {
      const cmd = new Deno.Command("deno", {
        args: ["task", "adm:job:run", jobname, runId],
        stdout: "piped",
        stderr: "piped",
      });
      const child = cmd.spawn();
      // Pipe logs to server logs
      (async () => {
        const decoder = new TextDecoder();
        const reader = child.stdout.getReader();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) console.log(`[job:${runId}]`, decoder.decode(value).trim());
        }
        reader.releaseLock();
      })();
      (async () => {
        const decoder = new TextDecoder();
        const reader = child.stderr.getReader();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) console.error(`[job:${runId}]`, decoder.decode(value).trim());
        }
        reader.releaseLock();
      })();
      // When job finishes, update running count and start next
      child.status.then(() => {
        const duration = (Date.now() - start) / 1000;
        jobsRunCounter.inc({ jobname });
        jobsDurationHistogram.observe({ jobname }, duration);
        onJobFinish();
      });
    } catch (err) {
      onJobFinish();
    }
  };
  const accepted = tryStartJob(startJob, runId);
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