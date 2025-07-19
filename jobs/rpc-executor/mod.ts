import { RpcClient } from "../../src/rpc/client.ts";
import { getPendingRpcCalls, updateRpcCall } from "../../db/rpc/mod.ts";

const MAX_RPC_CALLS_PER_RUN = parseInt(Deno.env.get("MAX_RPC_CALLS_PER_RUN") ?? "10", 10);
const DEFAULT_RATE_LIMIT_MS = parseInt(Deno.env.get("DEFAULT_RATE_LIMIT_MS") ?? "1000", 10);

export default async function RunJob() {
  const rpcClient = new RpcClient(DEFAULT_RATE_LIMIT_MS);
  
  // Set up rate limits for common RPC endpoints
  rpcClient.setRateLimit("solana-mainnet", 1000); // 1 call per second
  rpcClient.setRateLimit("solana-devnet", 500);   // 2 calls per second
  
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
      // Mark as running
      await updateRpcCall(call.id, {
        status: 'running',
        executed_at: new Date().toISOString(),
      });
      
      console.log(`Executing RPC call ${call.id} to ${call.url} (${call.method})`);
      
      // Make the RPC call
      const response = await rpcClient.makeRpcCall(call);
      
      if (response.success) {
        // Mark as completed
        await updateRpcCall(call.id, {
          status: 'completed',
          completed_at: new Date().toISOString(),
          result: response.result,
        });
        console.log(`RPC call ${call.id} completed successfully`);
      } else {
        // Handle failure
        const shouldRetry = call.retry_count < call.max_retries;
        const newStatus = shouldRetry ? 'pending' : 'failed';
        
        await updateRpcCall(call.id, {
          status: newStatus,
          completed_at: new Date().toISOString(),
          error: response.error,
          retry_count: call.retry_count + 1,
        });
        
        if (shouldRetry) {
          console.log(`RPC call ${call.id} failed, will retry (${call.retry_count + 1}/${call.max_retries}): ${response.error}`);
        } else {
          console.log(`RPC call ${call.id} failed permanently: ${response.error}`);
        }
      }
    } catch (error) {
      // Handle unexpected errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      await updateRpcCall(call.id, {
        status: 'failed',
        completed_at: new Date().toISOString(),
        error: `Unexpected error: ${errorMessage}`,
      });
      console.log(`Unexpected error processing RPC call ${call.id}: ${errorMessage}`);
    }
  }
  
  console.log(`RPC executor job completed, processed ${pendingCalls.length} calls`);
} 