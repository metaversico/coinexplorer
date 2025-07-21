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
      `INSERT INTO rpc_calls (method, params)
       VALUES ($1, $2)
       ON CONFLICT (method, params) DO NOTHING
       RETURNING id`,
      [
        request.method,
        JSON.stringify(request.params),
      ]
    );
    
    if (result.rows.length === 0) {
      const existingResult = await client.queryObject<{ id: string }>(
        `SELECT id FROM rpc_calls WHERE method = $1 AND params = $2`,
        [request.method, JSON.stringify(request.params)]
      );
      return existingResult.rows[0].id;
    }
    
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
      `SELECT rc.* FROM rpc_calls rc
       LEFT JOIN rpc_call_results rcr ON rc.id = rcr.rpc_call_id
       WHERE rcr.id IS NULL
       ORDER BY rc.created_at ASC
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
      `SELECT rc.* FROM rpc_calls rc
       LEFT JOIN rpc_call_results rcr ON rc.id = rcr.rpc_call_id
       WHERE rcr.id IS NULL
       ORDER BY rc.created_at ASC
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

export async function updateRpcCall(id: string, fields: Partial<RpcCall>): Promise<void> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const query = `UPDATE rpc_calls SET
      params = COALESCE($1, params)
      WHERE id = $2`;
    const values = [
      fields.params !== undefined ? JSON.stringify(fields.params) : null,
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
       INNER JOIN rpc_call_results rcr ON rc.id = rcr.rpc_call_id
       WHERE rcr.source_url LIKE $1
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


export async function getSignaturesWithoutTransactionData(limit: number = 100): Promise<{signature: string, id: string}[]> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const result = await client.queryObject<{signature: string, id: string}>(
      `SELECT s.signature, s.id
       FROM signatures s
       LEFT JOIN rpc_calls rc ON rc.method = 'getTransaction' 
         AND rc.params::jsonb->>0 = s.signature
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

export interface ApiTransactionResult {
  id: string;
  rpc_call_id: string;
  method: string;
  params: any;
  result: any;
  error: string | null;
  created_at: string;
  completed_at: string | null;
  source_url?: string;
  txn_signature?: string;
}

export async function getTransactions(limit = 50, offset = 0, method?: string, sort = 'desc'): Promise<ApiTransactionResult[]> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    let query = `
      SELECT 
        rcr.id,
        rcr.rpc_call_id,
        rc.method,
        rc.params,
        rcr.result,
        rcr.error,
        rcr.created_at,
        rcr.completed_at,
        CASE WHEN rc.method = 'getTransaction' THEN rc.params::jsonb->>0 ELSE NULL END as txn_signature
      FROM rpc_call_results rcr
      JOIN rpc_calls rc ON rcr.rpc_call_id = rc.id
      WHERE rcr.result IS NOT NULL
    `;
    
    const queryParams: any[] = [];
    let paramIndex = 1;
    
    if (method) {
      query += ` AND rc.method = $${paramIndex}`;
      queryParams.push(method);
      paramIndex++;
    }
    
    const sortDirection = sort.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY rcr.created_at ${sortDirection}`;
    
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);
    
    const result = await client.queryObject<ApiTransactionResult>(query, queryParams);
    return result.rows.map(row => ({
      ...row,
      params: typeof row.params === 'string' ? JSON.parse(row.params) : row.params,
      result: typeof row.result === 'string' ? JSON.parse(row.result) : row.result,
    }));
  } finally {
    client.release();
  }
}

export async function getTransaction(id: string): Promise<ApiTransactionResult | null> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const result = await client.queryObject<ApiTransactionResult>(`
      SELECT 
        rcr.id,
        rcr.rpc_call_id,
        rc.method,
        rc.params,
        rcr.result,
        rcr.error,
        rcr.source_url,
        rcr.created_at,
        rcr.completed_at,
        CASE WHEN rc.method = 'getTransaction' THEN rc.params::jsonb->>0 ELSE NULL END as txn_signature
      FROM rpc_call_results rcr
      JOIN rpc_calls rc ON rcr.rpc_call_id = rc.id
      WHERE rcr.id = $1
    `, [id]);
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return {
      ...row,
      params: typeof row.params === 'string' ? JSON.parse(row.params) : row.params,
      result: typeof row.result === 'string' ? JSON.parse(row.result) : row.result,
    };
  } finally {
    client.release();
  }
}

export async function getTransactionBySignature(signature: string): Promise<ApiTransactionResult | null> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const result = await client.queryObject<ApiTransactionResult>(`
      SELECT 
        rcr.id,
        rcr.rpc_call_id,
        rc.method,
        rc.params,
        rcr.result,
        rcr.error,
        rcr.source_url,
        rcr.created_at,
        rcr.completed_at,
        rc.params::jsonb->>0 as txn_signature
      FROM rpc_call_results rcr
      JOIN rpc_calls rc ON rcr.rpc_call_id = rc.id
      WHERE rc.method = 'getTransaction' 
        AND rc.params::jsonb->>0 = $1
        AND rcr.result IS NOT NULL
      ORDER BY rcr.created_at DESC
      LIMIT 1
    `, [signature]);
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return {
      ...row,
      params: typeof row.params === 'string' ? JSON.parse(row.params) : row.params,
      result: typeof row.result === 'string' ? JSON.parse(row.result) : row.result,
    };
  } finally {
    client.release();
  }
} 