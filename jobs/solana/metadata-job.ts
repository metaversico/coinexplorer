import { scheduleSolanaMetadataCalls } from "../../src/solana/metadata/mod.ts";

export default async function RunJob(params: { job: string; args: string[] }) {
  // Get the job run ID from the args if available
  const runId = params.args[0];
  
  console.log("Starting Solana metadata job - scheduling RPC calls");
  
  // Schedule RPC calls for all Solana coins
  const callIds = await scheduleSolanaMetadataCalls(runId);
  
  console.log(`Scheduled ${callIds.length} RPC calls for Solana metadata`);
  console.log("RPC calls will be processed by the rpc-executor job");
  
  return {
    message: `Scheduled ${callIds.length} RPC calls`,
    callIds,
  };
} 