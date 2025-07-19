import { parse } from "jsr:@std/yaml";
import { createRpcCall, getRpcCallsByJobId, updateRpcCall } from "../../../db/rpc/mod.ts";
import { getRpcCallById } from "../../../db/rpc/mod.ts";

const MARKETS_YML_PATH = new URL("../../../markets.yml", import.meta.url).pathname;
const SOLANA_RPC_URL = Deno.env.get("SOLANA_RPC_URL") ?? "https://api.mainnet-beta.solana.com";
const MAX_SIGNATURES_PER_CALL = parseInt(Deno.env.get("MAX_SIGNATURES_PER_CALL") ?? "1000", 10);
const MAX_CONCURRENT_CALLS = parseInt(Deno.env.get("MAX_CONCURRENT_CALLS") ?? "5", 10);
const WAIT_INTERVAL_MS = parseInt(Deno.env.get("WAIT_INTERVAL_MS") ?? "5000", 10);

interface Market {
  name: string;
  chain: string;
  type: string;
  address: string;
}

interface SignatureCall {
  marketAddress: string;
  callId: string;
  before?: string;
  limit: number;
}

export default async function RunJob(params: { job: string; args: string[] }) {
  const runId = params.args[0];
  
  console.log("Starting Solana signature backfill job");
  
  // Load markets from YAML
  const markets = await loadMarketsFromYaml();
  const solanaMarkets = markets.filter(market => market.chain === "solana");
  
  console.log(`Found ${solanaMarkets.length} Solana markets to backfill`);
  
  // Process each market
  for (const market of solanaMarkets) {
    console.log(`Processing market: ${market.name} (${market.address})`);
    await backfillMarketSignatures(market, runId);
  }
  
  console.log("Solana signature backfill job completed");
  
  return {
    message: `Backfilled signatures for ${solanaMarkets.length} markets`,
    markets: solanaMarkets.map(m => m.name),
  };
}

async function loadMarketsFromYaml(): Promise<Market[]> {
  const yml = await Deno.readTextFile(MARKETS_YML_PATH);
  const marketsParsed = parse(yml);
  return Array.isArray(marketsParsed) ? marketsParsed : [];
}

async function backfillMarketSignatures(market: Market, jobId: string): Promise<void> {
  const activeCalls: SignatureCall[] = [];
  let lastSignature: string | undefined;
  let totalSignatures = 0;
  
  console.log(`Starting backfill for ${market.name}`);
  
  // Initial call
  const initialCallId = await scheduleSignatureCall(market.address, jobId);
  activeCalls.push({
    marketAddress: market.address,
    callId: initialCallId,
    limit: MAX_SIGNATURES_PER_CALL,
  });
  
  // Process calls until no more signatures
  while (activeCalls.length > 0) {
    // Wait for some calls to complete
    await waitForCallCompletion(activeCalls, jobId);
    
    // Check completed calls and schedule next batch
    const newActiveCalls: SignatureCall[] = [];
    
    for (const call of activeCalls) {
      const rpcCall = await getRpcCallById(call.callId);
      
      if (!rpcCall) {
        console.log(`RPC call ${call.callId} not found, skipping`);
        continue;
      }
      
      if (rpcCall.status === 'completed' && rpcCall.result) {
        // Process the result
        const signatures = rpcCall.result;
        const signatureCount = signatures.length;
        totalSignatures += signatureCount;
        
        console.log(`Received ${signatureCount} signatures for ${market.name} (total: ${totalSignatures})`);
        
        if (signatureCount > 0) {
          // Get the last signature for the next call
          const lastSig = signatures[signatureCount - 1];
          lastSignature = lastSig.signature || lastSig;
          
          // Schedule next call if we got a full batch
          if (signatureCount === call.limit) {
            const nextCallId = await scheduleSignatureCall(
              market.address, 
              jobId, 
              lastSignature
            );
            newActiveCalls.push({
              marketAddress: market.address,
              callId: nextCallId,
              before: lastSignature,
              limit: MAX_SIGNATURES_PER_CALL,
            });
          }
        }
      } else if (rpcCall.status === 'failed') {
        console.log(`RPC call ${call.callId} failed: ${rpcCall.error}`);
        // Could implement retry logic here
      } else {
        // Still pending or running, keep in active calls
        newActiveCalls.push(call);
      }
    }
    
    activeCalls.length = 0;
    activeCalls.push(...newActiveCalls);
    
    // Limit concurrent calls
    if (activeCalls.length >= MAX_CONCURRENT_CALLS) {
      console.log(`Waiting for calls to complete (${activeCalls.length} active)`);
      await new Promise(resolve => setTimeout(resolve, WAIT_INTERVAL_MS));
    }
  }
  
  console.log(`Completed backfill for ${market.name}: ${totalSignatures} total signatures`);
}

async function scheduleSignatureCall(
  address: string, 
  jobId: string, 
  before?: string
): Promise<string> {
  const params: [string, any] = [address, { limit: MAX_SIGNATURES_PER_CALL }];
  
  if (before) {
    params[1] = { limit: MAX_SIGNATURES_PER_CALL, before };
  }
  
  const callId = await createRpcCall({
    url: SOLANA_RPC_URL,
    method: "getSignaturesForAddress",
    params,
    priority: 1, // Higher priority for backfill
    rate_limit_key: "solana-mainnet",
    job_id: jobId,
  });
  
  console.log(`Scheduled signature call for ${address}${before ? ` (before: ${before.substring(0, 8)}...)` : ''} - ID: ${callId}`);
  return callId;
}

async function waitForCallCompletion(activeCalls: SignatureCall[], jobId: string): Promise<void> {
  // Wait for at least one call to complete
  while (true) {
    const jobCalls = await getRpcCallsByJobId(jobId);
    const completedCalls = jobCalls.filter(call => 
      call.status === 'completed' || call.status === 'failed'
    );
    
    const activeCallIds = activeCalls.map(call => call.callId);
    const hasCompleted = completedCalls.some(call => activeCallIds.includes(call.id));
    
    if (hasCompleted) {
      break;
    }
    
    console.log(`Waiting for calls to complete... (${activeCalls.length} active)`);
    await new Promise(resolve => setTimeout(resolve, WAIT_INTERVAL_MS));
  }
} 