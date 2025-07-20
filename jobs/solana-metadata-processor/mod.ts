import { getRpcCallsBySourceUrlPattern } from "../../db/rpc/mod.ts";
import { processSolanaMetadataResults } from "../../src/rpc/processors/solana.ts";
import { createReceipt, hasServiceProcessedResource } from "../../db/receipts/mod.ts";

const PROCESSING_BATCH_SIZE = parseInt(Deno.env.get("RPC_PROCESSING_BATCH_SIZE") ?? "50", 10);
const SERVICE_NAME = "solana-metadata-processor";

export default async function RunJob() {
  console.log(`Starting ${SERVICE_NAME} job`);
  
  // Get completed Solana metadata RPC calls
  const metadataCalls = await getRpcCallsBySourceUrlPattern("%solana%", PROCESSING_BATCH_SIZE);
  
  // Filter only getAccountInfo calls that haven't been processed yet
  const filteredCalls = [];
  for (const call of metadataCalls) {
    if (call.method === 'getAccountInfo') {
      const alreadyProcessed = await hasServiceProcessedResource(
        SERVICE_NAME,
        "rpc_call",
        call.id,
        "processed_metadata"
      );
      if (!alreadyProcessed) {
        filteredCalls.push(call);
      }
    }
  }
  
  if (filteredCalls.length === 0) {
    console.log("No unprocessed Solana metadata RPC calls to process");
    return;
  }
  
  console.log(`Processing ${filteredCalls.length} unprocessed Solana metadata RPC calls`);
  
  // Process the metadata calls using existing processor
  await processSolanaMetadataResults(filteredCalls);
  
  // Create receipts for each processed call
  for (const call of filteredCalls) {
    try {
      await createReceipt(
        SERVICE_NAME,
        "rpc_call",
        call.id,
        "processed_metadata",
        {
          method: call.method,
          params: call.params
        }
      );
      
      console.log(`Created receipt for processing RPC call ${call.id}`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error creating receipt for call ${call.id}: ${errorMessage}`);
    }
  }
}