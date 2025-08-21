import { Pool, PoolClient } from "@postgres";
import { parse } from "jsr:@std/yaml";

let _coinsPgPool: Pool | null = null;

export function getCoinsPool() {
  if (!_coinsPgPool) {
    const connStr = Deno.env.get("COINS_PG_CONN");
    if (!connStr) throw new Error("COINS_PG_CONN env not set");
    _coinsPgPool = new Pool(connStr, 3, true);
  }
  return _coinsPgPool;
}

export async function closeCoinsPool() {
  if (_coinsPgPool) {
    await _coinsPgPool.end();
    _coinsPgPool = null;
  }
}

export async function upsertMarket(pool: Pool | PoolClient, address: string, metadata: any) {
  const client = pool instanceof Pool ? await pool.connect() : pool;
  try {
    const query = `
      INSERT INTO markets (address, metadata)
      VALUES ($1, $2)
      ON CONFLICT (address) DO UPDATE
      SET metadata = $2, updated_at = NOW()
    `;
    await client.queryObject(query, [address, JSON.stringify(metadata)]);
  } finally {
    if (pool instanceof Pool) {
      client.release();
    }
  }
}

export async function getMarketByAddress(address: string): Promise<{ address: string, metadata: any } | null> {
  const pool = getCoinsPool();
  const client = await pool.connect();
  try {
    const result = await client.queryObject<{ address: string, metadata: any }>(
      "SELECT address, metadata FROM markets WHERE address = $1",
      [address]
    );
    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      ...row,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
    };
  } finally {
    client.release();
  }
}

export async function getAllMarkets(): Promise<{ address: string, metadata: any }[]> {
    const pool = getCoinsPool();
    const client = await pool.connect();
    try {
      const result = await client.queryObject<{ address: string, metadata: any }>(
        "SELECT address, metadata FROM markets ORDER BY metadata->>'name' ASC"
      );
      return result.rows.map(row => ({
        ...row,
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      }));
    } finally {
      client.release();
    }
}

const MARKETS_YML_PATH = new URL("../../markets.yml", import.meta.url).pathname;

interface Market {
    name: string;
    chain: string;
    type: string;
    address: string;
}

export async function loadMarketsFromYaml(): Promise<Market[]> {
    const yml = await Deno.readTextFile(MARKETS_YML_PATH);
    const marketsParsed = parse(yml);
    if (!Array.isArray(marketsParsed)) {
        return [];
    }
    return marketsParsed.map((m: any) => ({
        name: m.name,
        chain: m.chain,
        type: m.type,
        address: m.address,
    }));
}
