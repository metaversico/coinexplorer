import { Pool } from "@postgres";

export interface Receipt {
  id: string;
  origin_uri: string;
  target_uri: string;
  action: string;
  metadata?: Record<string, any>;
  created_at: Date;
  job_id?: string;
}

let _receiptsPgPool: Pool | null = null;

function getPgPool() {
  if (!_receiptsPgPool) {
    const connStr = Deno.env.get("JOBRUNS_PG_CONN");
    if (!connStr) throw new Error("JOBRUNS_PG_CONN env not set");
    _receiptsPgPool = new Pool(connStr, 3, true);
  }
  return _receiptsPgPool;
}

export async function closeReceiptsPgPool() {
  if (_receiptsPgPool) {
    await _receiptsPgPool.end();
    _receiptsPgPool = null;
  }
}

export async function createReceipt(
  originUri: string,
  targetUri: string,
  action: string,
  metadata?: Record<string, any>,
  jobId?: string
): Promise<Receipt> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const query = `
      INSERT INTO receipts (origin_uri, target_uri, action, metadata, job_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const result = await client.queryObject<Receipt>(query, [
      originUri,
      targetUri,
      action,
      JSON.stringify(metadata || {}),
      jobId
    ]);
    
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function getReceiptsForTarget(
  targetUri: string,
  originUri?: string
): Promise<Receipt[]> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    let query = `
      SELECT * FROM receipts 
      WHERE target_uri = $1
    `;
    const params: any[] = [targetUri];
    
    if (originUri) {
      query += ` AND origin_uri = $2`;
      params.push(originUri);
    }
    
    query += ` ORDER BY created_at DESC`;
    
    const result = await client.queryObject<Receipt>(query, params);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function hasOriginProcessedTarget(
  originUri: string,
  targetUri: string,
  action: string
): Promise<boolean> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const query = `
      SELECT 1 FROM receipts 
      WHERE origin_uri = $1 AND target_uri = $2 AND action = $3
      LIMIT 1
    `;
    
    const result = await client.queryObject(query, [originUri, targetUri, action]);
    return result.rows.length > 0;
  } finally {
    client.release();
  }
}

export async function getUnprocessedTargets(
  resourceTable: string,
  resourceIdColumn: string,
  targetUriPrefix: string,
  originUri: string,
  action: string,
  limit = 100
): Promise<string[]> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const query = `
      SELECT DISTINCT r.${resourceIdColumn} as resource_id
      FROM ${resourceTable} r
      LEFT JOIN receipts rec ON rec.target_uri = $1 || '/' || r.${resourceIdColumn}::text
                            AND rec.origin_uri = $2
                            AND rec.action = $3
      WHERE rec.id IS NULL
      LIMIT $4
    `;
    
    const result = await client.queryObject<{resource_id: string}>(query, [
      targetUriPrefix,
      originUri,
      action,
      limit
    ]);
    
    return result.rows.map(row => row.resource_id);
  } finally {
    client.release();
  }
}