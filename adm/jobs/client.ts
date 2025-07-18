import { runningJobsGauge, queuedJobsGauge, jobsDroppedCounter, jobsRunCounter, jobsDurationHistogram } from "../metrics.ts";
import { updateJobRun } from "../db/mod.ts";

const MAX_JOBS_RUNNING = parseInt(Deno.env.get("MAX_JOBS_RUNNING") ?? "20", 10);
const MAX_JOBS_QUEUED = parseInt(Deno.env.get("MAX_JOBS_QUEUED") ?? "50", 10);
let runningJobs = 0;
const jobQueue: Array<{ jobname: string; runId: string }> = [];

export function runJobCommand(
  jobname: string,
  runId: string,
  onLog: (msg: string, isError: boolean) => void,
): Promise<{ success: boolean; code: number }> {
  const cmd = new Deno.Command("deno", {
    args: ["task", "adm:job:run", jobname, runId],
    stdout: "piped",
    stderr: "piped",
  });
  const child = cmd.spawn();
  (async () => {
    const decoder = new TextDecoder();
    const reader = child.stdout.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) onLog(`[job:${runId}] ${decoder.decode(value).trim()}`, false);
    }
    reader.releaseLock();
  })();
  (async () => {
    const decoder = new TextDecoder();
    const reader = child.stderr.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) onLog(`[job:${runId}] ${decoder.decode(value).trim()}`, true);
    }
    reader.releaseLock();
  })();
  return child.status;
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
      startJob(next.jobname, next.runId);
    }
  }
}

function startJob(jobname: string, runId: string) {
  const start = Date.now();
  runJobCommand(jobname, runId, (msg, isError) => {
    if (isError) {
      console.error(msg);
    } else {
      console.log(msg);
    }
  }).then(() => {
    const duration = (Date.now() - start) / 1000;
    jobsRunCounter.inc({ jobname });
    jobsDurationHistogram.observe({ jobname }, duration);
    onJobFinish();
  });
}

export function queueJob(jobname: string, runId: string): boolean {
  runningJobsGauge.set(runningJobs);
  queuedJobsGauge.set(jobQueue.length);
  if (runningJobs < MAX_JOBS_RUNNING) {
    runningJobs++;
    runningJobsGauge.set(runningJobs);
    updateJobRun(runId, { status: "pending" });
    startJob(jobname, runId);
  } else if (jobQueue.length < MAX_JOBS_QUEUED) {
    jobQueue.push({ jobname, runId });
    queuedJobsGauge.set(jobQueue.length);
    updateJobRun(runId, { status: "queued" });
  } else {
    jobsDroppedCounter.inc();
    return false;
  }
  return true;
} 