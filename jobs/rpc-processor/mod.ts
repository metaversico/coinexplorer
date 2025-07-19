import { getRpcCallsByUrlPattern } from "../../db/rpc/mod.ts";
import { processSolanaMetadataResults } from "../../src/rpc/processors/solana.ts";

const PROCESSING_BATCH_SIZE = parseInt(Deno.env.get("RPC_PROCESSING_BATCH_SIZE") ?? "50", 10);

export default async function RunJob() {
  console.log("Starting RPC result processor job");
  
  // Process Solana RPC results
  await processSolanaResults();
  
  console.log("RPC result processor job completed");
}

async function processSolanaResults() {
  // Get completed Solana RPC calls
  const solanaCalls = await getRpcCallsByUrlPattern("%solana%", PROCESSING_BATCH_SIZE);
  
  if (solanaCalls.length === 0) {
    console.log("No completed Solana RPC calls to process");
    return;
  }
  
  console.log(`Processing ${solanaCalls.length} completed Solana RPC calls`);
  
  // Group calls by method for batch processing
  const callsByMethod = new Map<string, typeof solanaCalls>();
  
  for (const call of solanaCalls) {
    const method = call.method;
    if (!callsByMethod.has(method)) {
      callsByMethod.set(method, []);
    }
    callsByMethod.get(method)!.push(call);
  }
  
  // Process each method type
  for (const [method, calls] of callsByMethod) {
    try {
      console.log(`Processing ${calls.length} calls with method: ${method}`);
      
      switch (method) {
        case 'getAccountInfo':
          await processSolanaMetadataResults(calls);
          break;
        // Add more method handlers as needed
        default:
          console.log(`No processor found for method: ${method}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error processing ${method} calls: ${errorMessage}`);
    }
  }
} 