import { getRpcCallsBySourceUrlPattern } from "../../db/rpc/mod.ts";
import { storeSignatures } from "../../db/signatures/mod.ts";
import { createReceipt, hasOriginProcessedTarget } from "../../db/receipts/mod.ts";

const PROCESSING_BATCH_SIZE = parseInt(Deno.env.get("RPC_PROCESSING_BATCH_SIZE") ?? "50", 10);
const SERVICE_NAME = "solana-signature-processor";

export default async function RunJob() {
  console.log(`Starting ${SERVICE_NAME} job`);
  
  // Get completed Solana signature RPC calls
  const signatureCalls = await getRpcCallsBySourceUrlPattern("%solana%", PROCESSING_BATCH_SIZE);
  
  // Filter only getSignaturesForAddress calls that haven't been processed yet
  const filteredCalls = [];
  for (const call of signatureCalls) {
    if (call.method === 'getSignaturesForAddress') {
      const alreadyProcessed = await hasOriginProcessedTarget(
        SERVICE_NAME,
        `rpc_call/${call.id}`,
        "processed_signatures"
      );
      if (!alreadyProcessed) {
        filteredCalls.push(call);
      }
    }
  }
  
  if (filteredCalls.length === 0) {
    console.log("No unprocessed Solana signature RPC calls to process");
    return;
  }
  
  console.log(`Processing ${filteredCalls.length} unprocessed Solana signature RPC calls`);
  
  for (const call of filteredCalls) {
    try {
      // Extract the address from the params
      const address = call.params[0];
      if (!address) {
        console.log(`Skipping call ${call.id}: no address in params`);
        continue;
      }
      
      // Get the result data from the results array
      const result = call.results?.find(r => r.result && !r.error)?.result;
      if (!result) {
        console.log(`Skipping call ${call.id}: no result data`);
        continue;
      }
      
      // Store the signatures
      const insertedCount = await storeSignatures(result, call.id);
      
      console.log(`Stored ${insertedCount} signatures from address ${address} (call: ${call.id})`);
      
      // Create receipt to track that this service processed this RPC call
      await createReceipt(
        SERVICE_NAME,
        `rpc_call/${call.id}`,
        "processed_signatures",
        {
          address,
          signatures_count: insertedCount,
          method: call.method
        }
      );
      
      console.log(`Created receipt for processing RPC call ${call.id}`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error processing signature call ${call.id}: ${errorMessage}`);
    }
  }
}