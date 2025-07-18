import { Counter, Gauge, Histogram, Registry } from "@prom-client";

export const registry = new Registry();

export const httpRequests = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "action", "status"],
});
export const runningJobsGauge = new Gauge({
  name: "adm_jobs_running",
  help: "Current number of running jobs",
});
export const queuedJobsGauge = new Gauge({
  name: "adm_jobs_queued",
  help: "Current number of queued jobs",
});
export const jobsDroppedCounter = new Counter({
  name: "adm_jobs_dropped_total",
  help: "Total number of jobs dropped due to full queue",
});
export const jobsRunCounter = new Counter({
  name: "adm_jobs_run_total",
  help: "Total number of jobs run by job name",
  labelNames: ["jobname"],
});
export const jobsDurationHistogram = new Histogram({
  name: "adm_job_duration_seconds",
  help: "Job duration in seconds by job name",
  labelNames: ["jobname"],
  buckets: [0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600],
});

registry.registerMetric(httpRequests);
registry.registerMetric(runningJobsGauge);
registry.registerMetric(queuedJobsGauge);
registry.registerMetric(jobsDroppedCounter);
registry.registerMetric(jobsRunCounter);
registry.registerMetric(jobsDurationHistogram); 