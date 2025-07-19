import { RpcCall } from "../client.ts";
import { getCoinsPool, upsertCoin } from "../../../db/coins/mod.ts";
import { Coin } from "../../solana/metadata/mod.ts";

export async function processSolanaMetadataResults(calls: RpcCall[]) {
  const pool = await getCoinsPool();
  
  try {
    // Filter calls that are getAccountInfo calls
    const metadataCalls = calls.filter(call => call.method === 'getAccountInfo');
    
    if (metadataCalls.length === 0) {
      console.log("No getAccountInfo calls to process");
      return;
    }
    
    console.log(`Processing ${metadataCalls.length} Solana metadata results`);
    
    for (const call of metadataCalls) {
      try {
        // Extract the address from the params
        const address = call.params[0];
        if (!address) {
          console.log(`Skipping call ${call.id}: no address in params`);
          continue;
        }
        
        // Get the result data
        const result = call.result;
        if (!result) {
          console.log(`Skipping call ${call.id}: no result data`);
          continue;
        }
        
        // Create a coin object from the RPC result
        const coin: Coin = {
          address,
          name: extractTokenName(result),
          symbol: extractTokenSymbol(result),
          chain: "solana",
        };
        
        // Upsert the coin with the full metadata
        await upsertCoin(pool, coin, result);
        
        console.log(`Processed metadata for ${coin.symbol} (${address})`);
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error processing call ${call.id}: ${errorMessage}`);
      }
    }
  } finally {
    await pool.end();
  }
}

function extractTokenName(result: any): string {
  // Try to extract token name from various possible locations in the result
  if (result?.value?.data?.parsed?.info?.name) {
    return result.value.data.parsed.info.name;
  }
  if (result?.value?.data?.parsed?.info?.mint) {
    return result.value.data.parsed.info.mint;
  }
  return "Unknown";
}

function extractTokenSymbol(result: any): string {
  // Try to extract token symbol from various possible locations in the result
  if (result?.value?.data?.parsed?.info?.symbol) {
    return result.value.data.parsed.info.symbol;
  }
  if (result?.value?.data?.parsed?.info?.mint) {
    // Use first 4 characters of mint address as symbol
    return result.value.data.parsed.info.mint.substring(0, 4).toUpperCase();
  }
  return "UNKNOWN";
} 