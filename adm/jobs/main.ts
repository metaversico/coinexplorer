import jobs from "../../jobs/mod.ts";
import { updateJobRun } from "../../db/mod.ts";

import "jsr:@std/dotenv/load"

const jobRegistry = jobs as Record<string, any>;

function formatError(error: unknown): { message: string; stack?: string; details?: string } {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      details: error.cause ? String(error.cause) : undefined,
    };
  }
  return {
    message: String(error),
  };
}

if (import.meta.main) {
  const [jobname, runId, ...rest] = Deno.args;
  if (!jobname) {
    console.error("Usage: deno task adm:job:run <jobname> [runId] [params...]");
    Deno.exit(1);
  }
  
  const jobFn = jobRegistry[jobname];
  if (!jobFn) {
    const error = `Job '${jobname}' not found. Available jobs: ${Object.keys(jobRegistry).join(", ")}`;
    console.error(error);
    if (runId) {
      await updateJobRun(runId, {
        status: "failed",
        error,
        exitCode: 1,
      });
    }
    Deno.exit(1);
  }
  
  const startedAt = new Date().toISOString();
  if (runId) {
    await updateJobRun(runId, { status: "running", started_at: startedAt });
  }
  
  try {
    const params = { job: jobname, args: rest };
    const result = await jobFn(params);
    
    if (runId) {
      await updateJobRun(runId, {
        status: "completed",
        finished_at: new Date().toISOString(),
        result: result ? JSON.stringify(result) : null,
      });
    }
    
    if (!runId && result !== undefined) {
      console.log(JSON.stringify(result));
    }
  } catch (err) {
    const errorInfo = formatError(err);
    const errorMessage = errorInfo.stack 
      ? `${errorInfo.message}\n\nStack trace:\n${errorInfo.stack}`
      : errorInfo.message;
    
    if (runId) {
      await updateJobRun(runId, {
        status: "failed",
        finished_at: new Date().toISOString(),
        error: errorMessage,
        exitCode: 1,
      });
    }
    
    // Always log the full error details to stderr
    console.error(`Error running job '${jobname}':`);
    console.error(errorMessage);
    if (errorInfo.details) {
      console.error(`Additional details: ${errorInfo.details}`);
    }
    
    Deno.exit(1);
  }
} 