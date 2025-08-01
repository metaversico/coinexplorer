import { RpcClient } from "../../src/rpc/client.ts";
import { getPendingRpcCalls, createRpcCallResult } from "../../db/rpc/mod.ts";

const MAX_RPC_CALLS_PER_RUN = parseInt(Deno.env.get("MAX_RPC_CALLS_PER_RUN") ?? "10", 10);
const SOLANA_RPC_URL = Deno.env.get("SOLANA_RPC_URL") ?? "https://api.mainnet-beta.solana.com";
const SOLANA_RPC_PROVIDER_NAME = Deno.env.get("SOLANA_RPC_PROVIDER_NAME") ?? "solana-mainnet-beta";

export default async function RunJob() {
  const rpcClient = new RpcClient();
  
  console.log(`Starting RPC executor job, max calls per run: ${MAX_RPC_CALLS_PER_RUN}`);
  
  // Get pending RPC calls
  const pendingCalls = await getPendingRpcCalls(MAX_RPC_CALLS_PER_RUN);
  
  if (pendingCalls.length === 0) {
    console.log("No pending RPC calls to process");
    return;
  }
  
  console.log(`Processing ${pendingCalls.length} pending RPC calls`);
  
  // Process each call
  for (const call of pendingCalls) {
    try {
      console.log(`Executing RPC call ${call.id} to ${SOLANA_RPC_URL} (${call.method})`);
      
      // Make the RPC call
      const response = await rpcClient.makeRpcCall(call, SOLANA_RPC_URL);
  
      if (response.success) {
        // Store result in separate table
        await createRpcCallResult(call.id, SOLANA_RPC_PROVIDER_NAME, response.result);
        console.log(`RPC call ${call.id} completed successfully`);
      } else {
        // Store error result in separate table
        await createRpcCallResult(call.id, SOLANA_RPC_PROVIDER_NAME, undefined, response.error);
        console.log(`RPC call ${call.id} failed: ${response.error}`);
      }
    } catch (error) {
      // Handle unexpected errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Store error result in separate table
      await createRpcCallResult(call.id, SOLANA_RPC_PROVIDER_NAME, undefined, `Unexpected error: ${errorMessage}`);
      console.log(`Unexpected error processing RPC call ${call.id}: ${errorMessage}`);
    }
  }
  
  console.log(`RPC executor job completed, processed ${pendingCalls.length} calls`);
} 