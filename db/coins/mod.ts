import { Pool } from "@postgres";
import { Coin, SolanaMetadata, processSolanaCoins } from "../../src/solana/metadata/mod.ts";

const COINS_PG_CONN = Deno.env.get("COINS_PG_CONN") ?? Deno.env.get("JOBRUNS_PG_CONN");

export interface CoinRecord {
  address: string;
  name: string;
  symbol: string;
  chain: string;
  metadata: string;
}

export async function getCoinsPool(): Promise<Pool> {
  if (!COINS_PG_CONN) {
    throw new Error("COINS_PG_CONN or JOBRUNS_PG_CONN env var required");
  }
  return new Pool(COINS_PG_CONN, 3, true);
}

export async function upsertCoin(pool: Pool, coin: Coin, metadata: SolanaMetadata): Promise<void> {
  const client = await pool.connect();
  try {
    await client.queryObject(
      `INSERT INTO coins (address, name, symbol, chain, metadata)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (address) DO UPDATE SET
         name = EXCLUDED.name,
         symbol = EXCLUDED.symbol,
         chain = EXCLUDED.chain,
         metadata = EXCLUDED.metadata`,
      [coin.address, coin.name, coin.symbol, coin.chain, JSON.stringify(metadata)],
    );
    console.log(`Upserted coin: ${coin.symbol} (${coin.address})`);
  } finally {
    client.release();
  }
}

export async function upsertCoinsBatch(
  pool: Pool, 
  coinsWithMetadata: Array<{ coin: Coin; metadata: SolanaMetadata }>
): Promise<void> {
  for (const { coin, metadata } of coinsWithMetadata) {
    await upsertCoin(pool, coin, metadata);
  }
}

export async function getCoinByAddress(pool: Pool, address: string): Promise<CoinRecord | null> {
  const client = await pool.connect();
  try {
    const result = await client.queryObject<CoinRecord>(
      "SELECT address, name, symbol, chain, metadata FROM coins WHERE address = $1",
      [address]
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function getAllCoins(pool: Pool): Promise<CoinRecord[]> {
  const client = await pool.connect();
  try {
    const result = await client.queryObject<CoinRecord>(
      "SELECT address, name, symbol, chain, metadata FROM coins ORDER BY symbol"
    );
    return result.rows;
  } finally {
    client.release();
  }
}

// Main orchestration function
export async function processAndStoreSolanaCoins(): Promise<void> {
  const pool = await getCoinsPool();
  
  try {
    // Process coins from YAML and fetch metadata
    const coinsWithMetadata = await processSolanaCoins();
    
    // Upsert all coins to database
    await upsertCoinsBatch(pool, coinsWithMetadata);
    
    console.log(`Successfully processed ${coinsWithMetadata.length} Solana coins`);
  } finally {
    await pool.end();
  }
} 