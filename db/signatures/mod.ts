import { Pool } from "@postgres";

let _signaturesPgPool: Pool | null = null;

function getPgPool() {
  if (!_signaturesPgPool) {
    const connStr = Deno.env.get("JOBRUNS_PG_CONN");
    if (!connStr) throw new Error("JOBRUNS_PG_CONN env not set");
    _signaturesPgPool = new Pool(connStr, 3, true);
  }
  return _signaturesPgPool;
}

export async function closeSignaturesPgPool() {
  if (_signaturesPgPool) {
    await _signaturesPgPool.end();
    _signaturesPgPool = null;
  }
}

export interface Signature {
  id: string;
  signature: string;
  slot?: number;
  err?: string;
  memo?: string;
  block_time?: number;
  confirmation_status?: string;
  created_at: string;
  rpc_call_id?: string;
}

export async function storeSignatures(
  signatures: any[], 
  rpcCallId?: string
): Promise<number> {
  const pool = getPgPool();
  const client = await pool.connect();
  
  try {
    let insertedCount = 0;
    
    for (const sig of signatures) {
      try {
        await client.queryObject(
          `INSERT INTO signatures (
            signature, slot, err, memo, block_time, 
            confirmation_status, rpc_call_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (signature) DO NOTHING`,
          [
            sig.signature,
            sig.slot || null,
            sig.err || null,
            sig.memo || null,
            sig.blockTime || null,
            sig.confirmationStatus || null,
            rpcCallId || null,
          ]
        );
        
        // Check if a row was actually inserted
        const result = await client.queryObject(
          "SELECT 1 FROM signatures WHERE signature = $1",
          [sig.signature]
        );
        
        if (result.rows.length > 0) {
          insertedCount++;
        }
      } catch (error) {
        console.error(`Error inserting signature ${sig.signature}:`, error);
      }
    }
    
    return insertedCount;
  } finally {
    client.release();
  }
}

export async function getSignatures(
  limit: number = 100,
  offset: number = 0
): Promise<Signature[]> {
  const pool = getPgPool();
  const client = await pool.connect();
  
  try {
    const result = await client.queryObject<Signature>(
      `SELECT * FROM signatures 
       ORDER BY block_time DESC, created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

export async function getSignatureCount(): Promise<number> {
  const pool = getPgPool();
  const client = await pool.connect();
  
  try {
    const result = await client.queryObject<{ count: string }>(
      "SELECT COUNT(*) as count FROM signatures"
    );
    return parseInt(result.rows[0].count, 10);
  } finally {
    client.release();
  }
}

export async function getLatestSignature(): Promise<Signature | null> {
  const pool = getPgPool();
  const client = await pool.connect();
  
  try {
    const result = await client.queryObject<Signature>(
      `SELECT * FROM signatures 
       ORDER BY block_time DESC, created_at DESC
       LIMIT 1`
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function getOldestSignature(): Promise<Signature | null> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const result = await client.queryObject<Signature>(
      `SELECT * FROM signatures 
       ORDER BY block_time ASC, created_at ASC
       LIMIT 1`
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function getSignaturesByTimeRange(
  startTime: number,
  endTime: number
): Promise<Signature[]> {
  const pool = getPgPool();
  const client = await pool.connect();
  
  try {
    const result = await client.queryObject<Signature>(
      `SELECT * FROM signatures 
       WHERE block_time >= $1 
       AND block_time <= $2
       ORDER BY block_time ASC`,
      [startTime, endTime]
    );
    return result.rows;
  } finally {
    client.release();
  }
} 