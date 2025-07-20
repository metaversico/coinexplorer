import { RpcCallWithResults } from "../client.ts";
import { storeSignatures } from "../../../db/signatures/mod.ts";

export async function processSolanaSignatureResults(calls: RpcCallWithResults[]) {
  console.log(`Processing ${calls.length} Solana signature results`);
  
  for (const call of calls) {
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
      
      console.log(`Stored ${insertedCount} signatures for address ${address} (call: ${call.id})`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error processing signature call ${call.id}: ${errorMessage}`);
    }
  }
} 