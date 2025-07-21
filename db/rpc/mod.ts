import { Pool } from "@postgres";
import { RpcCall, RpcRequest, RpcCallResult, RpcCallWithResults } from "../../src/rpc/client.ts";

let _rpcPgPool: Pool | null = null;

function getPgPool() {
  if (!_rpcPgPool) {
    const connStr = Deno.env.get("JOBRUNS_PG_CONN");
    if (!connStr) throw new Error("JOBRUNS_PG_CONN env not set");
    _rpcPgPool = new Pool(connStr, 3, true);
  }
  return _rpcPgPool;
}

export async function closeRpcPgPool() {
  if (_rpcPgPool) {
    await _rpcPgPool.end();
    _rpcPgPool = null;
  }
}

export async function createRpcCall(request: RpcRequest): Promise<string> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const result = await client.queryObject<{ id: string }>(
      `INSERT INTO rpc_calls (method, params, priority, rate_limit_key, job_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (method, params) DO UPDATE SET
         status = CASE 
           WHEN rpc_calls.status = 'failed' THEN 'pending'
           ELSE rpc_calls.status
         END
       RETURNING id`,
      [
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
    }));
  } finally {
    client.release();
  }
}

export async function getPendingRpcCallsForChain(chain: string, limit: number = 10): Promise<RpcCall[]> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const result = await client.queryObject<RpcCall>(
      `SELECT * FROM rpc_calls 
       WHERE status = 'pending' 
       AND scheduled_at <= now()
       AND (rate_limit_key LIKE $1 OR rate_limit_key IS NULL)
       ORDER BY priority DESC, created_at ASC
       LIMIT $2`,
      [`${chain}%`, limit]
    );
    return result.rows.map(row => ({
      ...row,
      params: typeof row.params === 'string' ? JSON.parse(row.params) : row.params,
    }));
  } finally {
    client.release();
  }
}

export async function updateRpcCall(id: string, fields: Partial<RpcCall>): Promise<void> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const query = `UPDATE rpc_calls SET
      status = COALESCE($1, status),
      executed_at = COALESCE($2, executed_at),
      completed_at = COALESCE($3, completed_at),
      retry_count = COALESCE($4, retry_count),
      params = COALESCE($5, params),
      priority = COALESCE($6, priority),
      rate_limit_key = COALESCE($7, rate_limit_key),
      job_id = COALESCE($8, job_id)
      WHERE id = $9`;
    const values = [
      fields.status ?? null,
      fields.executed_at ?? null,
      fields.completed_at ?? null,
      fields.retry_count ?? null,
      fields.params !== undefined ? JSON.stringify(fields.params) : null,
      fields.priority ?? null,
      fields.rate_limit_key ?? null,
      fields.job_id ?? null,
      id
    ];
    await client.queryObject(query, values);
  } finally {
    client.release();
  }
}

export async function createRpcCallResult(rpcCallId: string, sourceUrl: string, result?: any, error?: string): Promise<string> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const queryResult = await client.queryObject<{ id: string }>(
      `INSERT INTO rpc_call_results (rpc_call_id, source_url, result, error, completed_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        rpcCallId,
        sourceUrl,
        result !== undefined ? JSON.stringify(result) : null,
        error || null,
        new Date().toISOString(),
      ]
    );
    return queryResult.rows[0].id;
  } finally {
    client.release();
  }
}

export async function getRpcCallsBySourceUrlPattern(pattern: string, limit: number = 100): Promise<RpcCallWithResults[]> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const result = await client.queryObject<any>(
      `SELECT 
         rc.*,
         COALESCE(
           json_agg(
             json_build_object(
               'id', rcr.id,
               'rpc_call_id', rcr.rpc_call_id,
               'source_url', rcr.source_url,
               'result', rcr.result,
               'error', rcr.error,
               'created_at', rcr.created_at,
               'completed_at', rcr.completed_at
             )
             ORDER BY rcr.completed_at DESC
           ) FILTER (WHERE rcr.id IS NOT NULL),
           '[]'::json
         ) as results
       FROM rpc_calls rc
       LEFT JOIN rpc_call_results rcr ON rc.id = rcr.rpc_call_id
       WHERE rcr.source_url LIKE $1
       AND rc.status = 'completed'
       GROUP BY rc.id
       ORDER BY MAX(rcr.completed_at) DESC
       LIMIT $2`,
      [pattern, limit]
    );
    return result.rows.map(row => ({
      ...row,
      params: typeof row.params === 'string' ? JSON.parse(row.params) : row.params,
      results: row.results.map((r: any) => ({
        ...r,
        result: r.result && typeof r.result === 'string' ? JSON.parse(r.result) : r.result,
      })),
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
    };
  } finally {
    client.release();
  }
}

export async function getRpcCallWithResultsById(id: string): Promise<RpcCallWithResults | null> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const result = await client.queryObject<any>(
      `SELECT 
         rc.*,
         COALESCE(
           json_agg(
             json_build_object(
               'id', rcr.id,
               'rpc_call_id', rcr.rpc_call_id,
               'source_url', rcr.source_url,
               'result', rcr.result,
               'error', rcr.error,
               'created_at', rcr.created_at,
               'completed_at', rcr.completed_at
             )
             ORDER BY rcr.completed_at DESC
           ) FILTER (WHERE rcr.id IS NOT NULL),
           '[]'::json
         ) as results
       FROM rpc_calls rc
       LEFT JOIN rpc_call_results rcr ON rc.id = rcr.rpc_call_id
       WHERE rc.id = $1
       GROUP BY rc.id`,
      [id]
    );
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return {
      ...row,
      params: typeof row.params === 'string' ? JSON.parse(row.params) : row.params,
      results: row.results.map((r: any) => ({
        ...r,
        result: r.result && typeof r.result === 'string' ? JSON.parse(r.result) : r.result,
      })),
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
    }));
  } finally {
    client.release();
  }
}

export async function getSignaturesWithoutTransactionData(limit: number = 100): Promise<{signature: string, id: string}[]> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const result = await client.queryObject<{signature: string, id: string}>(
      `SELECT s.signature, s.id
       FROM signatures s
       LEFT JOIN rpc_calls rc ON rc.method = 'getTransaction' 
         AND rc.params::jsonb->>0 = s.signature
         AND rc.status = 'completed'
       LEFT JOIN rpc_call_results rcr ON rc.id = rcr.rpc_call_id
         AND rcr.result IS NOT NULL
       WHERE rcr.id IS NULL
       AND s.signature IS NOT NULL
       ORDER BY s.block_time DESC, s.created_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  } finally {
    client.release();
  }
} 