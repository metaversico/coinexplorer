import { parse } from "jsr:@std/yaml";
import { Pool } from "@postgres";

const COINS_YML_PATH = new URL("../../coins.yml", import.meta.url).pathname;
const SOLANA_RPC_URL = Deno.env.get("SOLANA_RPC_URL") ?? "https://api.mainnet-beta.solana.com";
const COINS_PG_CONN = Deno.env.get("COINS_PG_CONN") ?? Deno.env.get("JOBRUNS_PG_CONN");

async function fetchSolanaMetadata(address: string) {
  // Minimal Solana getAccountInfo RPC call for demonstration
  const res = await fetch(SOLANA_RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getAccountInfo",
      params: [address, { encoding: "jsonParsed" }],
    }),
  });
  const data = await res.json();
  return data.result;
}

async function upsertCoin(pool: Pool, coin: any, metadata: any) {
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
  } finally {
    client.release();
  }
}

export default async function RunJob() {
  if (!COINS_PG_CONN) throw new Error("COINS_PG_CONN or JOBRUNS_PG_CONN env var required");
  const pool = new Pool(COINS_PG_CONN, 3, true);
  const yml = await Deno.readTextFile(COINS_YML_PATH);
  const coinsParsed = parse(yml);
  const coins = Array.isArray(coinsParsed) ? coinsParsed : [];
  for (const coin of coins) {
    if (coin.chain !== "solana") continue;
    const metadata = await fetchSolanaMetadata(coin.address);
    await upsertCoin(pool, coin, metadata);
    console.log(`Upserted coin: ${coin.symbol} (${coin.address})`);
  }
  await pool.end();
} 