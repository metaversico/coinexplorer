import { Pool } from "@postgres";

export interface Receipt {
  id: string;
  service_name: string;
  resource_type: string;
  resource_id: string;
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
  serviceName: string,
  resourceType: string,
  resourceId: string,
  action: string,
  metadata?: Record<string, any>,
  jobId?: string
): Promise<Receipt> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const query = `
      INSERT INTO receipts (service_name, resource_type, resource_id, action, metadata, job_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const result = await client.queryObject<Receipt>(query, [
      serviceName,
      resourceType,
      resourceId,
      action,
      JSON.stringify(metadata || {}),
      jobId
    ]);
    
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function getReceiptsForResource(
  resourceType: string,
  resourceId: string,
  serviceName?: string
): Promise<Receipt[]> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    let query = `
      SELECT * FROM receipts 
      WHERE resource_type = $1 AND resource_id = $2
    `;
    const params: any[] = [resourceType, resourceId];
    
    if (serviceName) {
      query += ` AND service_name = $3`;
      params.push(serviceName);
    }
    
    query += ` ORDER BY created_at DESC`;
    
    const result = await client.queryObject<Receipt>(query, params);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function hasServiceProcessedResource(
  serviceName: string,
  resourceType: string,
  resourceId: string,
  action: string
): Promise<boolean> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const query = `
      SELECT 1 FROM receipts 
      WHERE service_name = $1 AND resource_type = $2 AND resource_id = $3 AND action = $4
      LIMIT 1
    `;
    
    const result = await client.queryObject(query, [serviceName, resourceType, resourceId, action]);
    return result.rows.length > 0;
  } finally {
    client.release();
  }
}

export async function getUnprocessedResources(
  resourceType: string,
  serviceName: string,
  action: string,
  limit = 100
): Promise<string[]> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const query = `
      SELECT DISTINCT r.id as resource_id
      FROM ${resourceType} r
      LEFT JOIN receipts rec ON rec.resource_type = $1 
                            AND rec.resource_id = r.id::text 
                            AND rec.service_name = $2 
                            AND rec.action = $3
      WHERE rec.id IS NULL
      LIMIT $4
    `;
    
    const result = await client.queryObject<{resource_id: string}>(query, [
      resourceType,
      serviceName,
      action,
      limit
    ]);
    
    return result.rows.map(row => row.resource_id);
  } finally {
    client.release();
  }
}