import { parse } from "jsr:@std/yaml";
import { createRpcCall } from "../../../db/rpc/mod.ts";

const COINS_YML_PATH = new URL("../../../coins.yml", import.meta.url).pathname;
const SOLANA_RPC_URL = Deno.env.get("SOLANA_RPC_URL") ?? "https://api.mainnet-beta.solana.com";

export interface Coin {
  address: string;
  name: string;
  symbol: string;
  chain: string;
}

export interface SolanaMetadata {
  result: any;
}

export async function loadCoinsFromYaml(): Promise<Coin[]> {
  const yml = await Deno.readTextFile(COINS_YML_PATH);
  const coinsParsed = parse(yml);
  const coins = Array.isArray(coinsParsed) ? coinsParsed : [];
  return coins.filter((coin: Coin) => coin.chain === "solana");
}

export async function scheduleSolanaMetadataCalls(jobId?: string): Promise<string[]> {
  const coins = await loadCoinsFromYaml();
  const callIds: string[] = [];
  
  for (const coin of coins) {
    const callId = await createRpcCall({
      method: "getAccountInfo",
      params: [coin.address, { encoding: "jsonParsed" }],
    });
    callIds.push(callId);
    console.log(`Scheduled RPC call for: ${coin.symbol} (${coin.address}) - ID: ${callId}`);
  }
  
  return callIds;
}

// Legacy function for backward compatibility
export async function fetchSolanaMetadata(address: string): Promise<SolanaMetadata> {
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
  return data;
}

// Legacy function for backward compatibility
export async function processSolanaCoins(): Promise<Array<{ coin: Coin; metadata: SolanaMetadata }>> {
  const coins = await loadCoinsFromYaml();
  const results = [];
  
  for (const coin of coins) {
    const metadata = await fetchSolanaMetadata(coin.address);
    results.push({ coin, metadata });
    console.log(`Fetched metadata for: ${coin.symbol} (${coin.address})`);
  }
  
  return results;
} 