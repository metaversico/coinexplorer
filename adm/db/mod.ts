import { Pool } from "@postgres";

function getPgPool() {
  const connStr = Deno.env.get("JOBRUNS_PG_CONN");
  if (!connStr) throw new Error("JOBRUNS_PG_CONN env not set");
  return new Pool(connStr, 3, true);
}

export async function createJobRun(jobname: string): Promise<string> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const runId = crypto.randomUUID();
    const now = new Date().toISOString();
    await client.queryObject(
      "INSERT INTO job_runs (id, jobname, status, started_at) VALUES ($1, $2, $3, $4)",
      [runId, jobname, "pending", now],
    );
    return runId;
  } finally {
    client.release();
  }
}

export async function getJobRun(runId: string) {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const result = await client.queryObject(
      "SELECT * FROM job_runs WHERE id = $1",
      [runId],
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function updateJobRun(runId: string, fields: Record<string, unknown>) {
  const pool = getPgPool();
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