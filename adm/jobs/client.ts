import { runningJobsGauge, queuedJobsGauge, jobsDroppedCounter, jobsRunCounter, jobsDurationHistogram } from "../metrics.ts";
import { updateJobRun } from "../../db/mod.ts";

function logJobEvent({
  runId,
  jobname,
  level,
  message,
  origin,
}: {
  runId: string;
  jobname: string;
  level: "info" | "error";
  message: string;
  origin: "stdout" | "stderr";
}) {
  const log = {
    timestamp: new Date().toISOString(),
    runId,
    jobname,
    level,
    origin,
    message,
  };
  // Use console.log for all logs; log level is in the JSON
  console.log(JSON.stringify(log));
}

const MAX_JOBS_RUNNING = parseInt(Deno.env.get("MAX_JOBS_RUNNING") ?? "20", 10);
const MAX_JOBS_QUEUED = parseInt(Deno.env.get("MAX_JOBS_QUEUED") ?? "50", 10);
let runningJobs = 0;
const jobQueue: Array<{ jobname: string; runId: string }> = [];

export function runJobCommand(
  jobname: string,
  runId: string,
  onLog?: (msg: string, isError: boolean) => void,
): Promise<{ success: boolean; code: number; error?: string }> {
  const cmd = new Deno.Command("deno", {
    args: ["task", "adm:job:run", jobname, runId],
    stdout: "piped",
    stderr: "piped",
  });
  const child = cmd.spawn();
  
  let stderrOutput = "";
  
  (async () => {
    const decoder = new TextDecoder();
    const reader = child.stdout.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        const msg = decoder.decode(value).trim();
        logJobEvent({
          runId,
          jobname,
          level: "info",
          message: msg,
          origin: "stdout",
        });
        if (onLog) onLog(msg, false);
      }
    }
    reader.releaseLock();
  })();

  (async () => {
    const decoder = new TextDecoder();
    const reader = child.stderr.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        const msg = decoder.decode(value).trim();
        stderrOutput += msg + "\n";
        logJobEvent({
          runId,
          jobname,
          level: "error",
          message: msg,
          origin: "stderr",
        });
        if (onLog) onLog(msg, true);
      }
    }
    reader.releaseLock();
  })();
  
  return child.status.then((status) => {
    if (!status.success && stderrOutput) {
      return {
        success: false,
        code: status.code,
        error: stderrOutput.trim(),
      };
    }
    return {
      success: status.success,
      code: status.code,
    };
  });
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
    // No-op: logs are handled by logJobEvent
  }).then((result) => {
    const duration = (Date.now() - start) / 1000;
    jobsRunCounter.inc({ jobname });
    jobsDurationHistogram.observe({ jobname }, duration);
    
    // Update job run status with detailed error information
    if (!result.success) {
      const errorDetails = {
        status: "failed",
        error: result.error || `Job failed with exit code ${result.code}`,
        exitCode: result.code,
      };
      updateJobRun(runId, errorDetails);
      
      // Log the complete error details
      logJobEvent({
        runId,
        jobname,
        level: "error",
        message: `Job failed with exit code ${result.code}: ${result.error || "Unknown error"}`,
        origin: "stderr",
      });
    } else {
      updateJobRun(runId, { status: "completed" });
    }
    
    onJobFinish();
  }).catch((error) => {
    const duration = (Date.now() - start) / 1000;
    jobsRunCounter.inc({ jobname });
    jobsDurationHistogram.observe({ jobname }, duration);
    
    // Handle unexpected errors (like process spawn failures)
    const errorMessage = error instanceof Error ? error.stack || error.message : String(error);
    updateJobRun(runId, { 
      status: "failed", 
      error: `Unexpected error: ${errorMessage}`,
      exitCode: -1,
    });
    
    logJobEvent({
      runId,
      jobname,
      level: "error",
      message: `Unexpected error running job: ${errorMessage}`,
      origin: "stderr",
    });
    
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