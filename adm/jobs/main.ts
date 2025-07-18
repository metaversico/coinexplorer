import jobs from "../../jobs/mod.ts";
import { updateJobRun } from "../db/mod.ts";

const jobRegistry = jobs as Record<string, any>;

if (import.meta.main) {
  const [jobname, runId, ...rest] = Deno.args;
  if (!jobname) {
    console.error("Usage: deno task adm:job:run <jobname> [runId] [params...]");
    Deno.exit(1);
  }
  const jobFn = jobRegistry[jobname];
  if (!jobFn) {
    console.error(`Job '${jobname}' not found.`);
    Deno.exit(1);
  }
  let result, error;
  const startedAt = new Date().toISOString();
  if (runId) {
    await updateJobRun(runId, { status: "running", started_at: startedAt });
  }
  try {
    const params = { job: jobname, args: rest };
    result = await jobFn(params);
    if (runId) {
      await updateJobRun(runId, {
        status: "success",
        finished_at: new Date().toISOString(),
        result: result ? JSON.stringify(result) : null,
      });
    }
    if (!runId && result !== undefined) {
      console.log(JSON.stringify(result));
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    if (runId) {
      await updateJobRun(runId, {
        status: "error",
        finished_at: new Date().toISOString(),
        error,
      });
    }
    if (!runId) {
      console.error(`Error running job '${jobname}':`, error);
      Deno.exit(1);
    }
  }
} 