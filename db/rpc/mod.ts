import { Pool } from "@postgres";
import { RpcCall, RpcRequest } from "../../src/rpc/client.ts";

function getPgPool() {
  const connStr = Deno.env.get("JOBRUNS_PG_CONN");
  if (!connStr) throw new Error("JOBRUNS_PG_CONN env not set");
  return new Pool(connStr, 3, true);
}

export async function createRpcCall(request: RpcRequest): Promise<string> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const result = await client.queryObject<{ id: string }>(
      `INSERT INTO rpc_calls (url, method, params, priority, rate_limit_key, job_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        request.url,
        request.method,
        JSON.stringify(request.params),
        request.priority || 0,
        request.rate_limit_key || null,
        request.job_id || null,
      ]
    );
    return result.rows[0].id;
  } finally {
    client.release();
  }
}

export async function getPendingRpcCalls(limit: number = 10): Promise<RpcCall[]> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const result = await client.queryObject<RpcCall>(
      `SELECT * FROM rpc_calls 
       WHERE status = 'pending' 
       AND scheduled_at <= now()
       ORDER BY priority DESC, created_at ASC
       LIMIT $1`,
      [limit]
    );
    return result.rows.map(row => ({
      ...row,
      params: typeof row.params === 'string' ? JSON.parse(row.params) : row.params,
      result: row.result ? (typeof row.result === 'string' ? JSON.parse(row.result) : row.result) : undefined,
    }));
  } finally {
    client.release();
  }
}

export async function updateRpcCall(id: string, fields: Partial<RpcCall>): Promise<void> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const updates: string[] = [];
    const values: any[] = [id];
    let paramIndex = 2;

    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updates.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (updates.length === 0) return;

    await client.queryObject(
      `UPDATE rpc_calls SET ${updates.join(', ')} WHERE id = $1`,
      values
    );
  } finally {
    client.release();
  }
}

export async function getRpcCallsByUrlPattern(pattern: string, limit: number = 100): Promise<RpcCall[]> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const result = await client.queryObject<RpcCall>(
      `SELECT * FROM rpc_calls 
       WHERE url LIKE $1 
       AND status = 'completed'
       ORDER BY completed_at DESC
       LIMIT $2`,
      [pattern, limit]
    );
    return result.rows.map(row => ({
      ...row,
      params: typeof row.params === 'string' ? JSON.parse(row.params) : row.params,
      result: row.result ? (typeof row.result === 'string' ? JSON.parse(row.result) : row.result) : undefined,
    }));
  } finally {
    client.release();
  }
}

export async function getRpcCallById(id: string): Promise<RpcCall | null> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const result = await client.queryObject<RpcCall>(
      "SELECT * FROM rpc_calls WHERE id = $1",
      [id]
    );
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return {
      ...row,
      params: typeof row.params === 'string' ? JSON.parse(row.params) : row.params,
      result: row.result ? (typeof row.result === 'string' ? JSON.parse(row.result) : row.result) : undefined,
    };
  } finally {
    client.release();
  }
}

export async function getRpcCallsByJobId(jobId: string): Promise<RpcCall[]> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const result = await client.queryObject<RpcCall>(
      "SELECT * FROM rpc_calls WHERE job_id = $1 ORDER BY created_at ASC",
      [jobId]
    );
    return result.rows.map(row => ({
      ...row,
      params: typeof row.params === 'string' ? JSON.parse(row.params) : row.params,
      result: row.result ? (typeof row.result === 'string' ? JSON.parse(row.result) : row.result) : undefined,
    }));
  } finally {
    client.release();
  }
} 