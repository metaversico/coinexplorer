import jobs from "../../jobs/mod.ts";
import { Pool } from "@postgres";

const jobRegistry = jobs as Record<string, any>;

async function updateRun(runId: string, fields: Record<string, unknown>) {
  const pool = new Pool(Deno.env.get("JOBRUNS_PG_CONN")!, 3, true);
  const client = await pool.connect();
  try {
    const sets = Object.keys(fields).map((k, i) => `${k} = $${i + 2}`).join(", ");
    const values = [runId, ...Object.values(fields)];
    await client.queryObject(
      `UPDATE job_runs SET ${sets} WHERE id = $1`,
      values,
    );
  } finally {
    client.release();
  }
}

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
    await updateRun(runId, { status: "running", started_at: startedAt });
  }
  try {
    const params = { job: jobname, args: rest };
    result = await jobFn(params);
    if (runId) {
      await updateRun(runId, {
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
      await updateRun(runId, {
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