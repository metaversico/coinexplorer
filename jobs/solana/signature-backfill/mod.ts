import { parse } from "jsr:@std/yaml";
import { createRpcCall } from "../../../db/rpc/mod.ts";
import { getOldestSignature } from "../../../db/signatures/mod.ts";

const MARKETS_YML_PATH = new URL("../../../markets.yml", import.meta.url).pathname;
const SOLANA_RPC_URL = Deno.env.get("SOLANA_RPC_URL") ?? "https://api.mainnet-beta.solana.com";
const MAX_SIGNATURES_PER_CALL = parseInt(Deno.env.get("MAX_SIGNATURES_PER_CALL") ?? "1000", 10);

interface Market {
  name: string;
  chain: string;
  type: string;
  address: string;
}

export default async function RunJob(params: { job: string; args: string[] }) {
  const runId = params.args[0];
  
  console.log("Starting Solana signature backfill job");
  
  // Load markets from YAML
  const markets = await loadMarketsFromYaml();
  const solanaMarkets = markets.filter(market => market.chain === "solana");
  
  console.log(`Found ${solanaMarkets.length} Solana markets to backfill`);
  
  const scheduledCalls: string[] = [];
  
  // Get the global oldest signature across all markets
  const oldestSignature = await getOldestSignature();
  
  // Process each market - markets now only direct what addresses to load signatures for
  for (const market of solanaMarkets) {
    console.log(`Processing market: ${market.name} (${market.address})`);
    
    try {
      if (oldestSignature) {
        console.log(`Using global oldest signature: ${oldestSignature.signature.substring(0, 8)}... for market ${market.name}`);
        
        // Schedule a request for this market's address using the global oldest signature as 'before'
        const callId = await scheduleSignatureCall(
          market.address, 
          runId, 
          oldestSignature.signature
        );
        scheduledCalls.push(callId);
        
        console.log(`Scheduled signature call for ${market.name} from global oldest signature - ID: ${callId}`);
      } else {
        console.log(`No signatures found globally, scheduling initial call for ${market.name}`);
        
        // No signatures found globally, schedule initial call for this market
        const callId = await scheduleSignatureCall(market.address, runId);
        scheduledCalls.push(callId);
        
        console.log(`Scheduled initial signature call for ${market.name} - ID: ${callId}`);
      }
    } catch (error) {
      console.error(`Error processing market ${market.name}:`, error);
    }
  }
  
  console.log(`Solana signature backfill job completed. Scheduled ${scheduledCalls.length} calls.`);
  
  return {
    message: `Scheduled signature calls for ${scheduledCalls.length} markets`,
    markets: solanaMarkets.map(m => m.name),
    scheduledCalls,
  };
}

async function loadMarketsFromYaml(): Promise<Market[]> {
  const yml = await Deno.readTextFile(MARKETS_YML_PATH);
  const marketsParsed = parse(yml);
  return Array.isArray(marketsParsed) ? marketsParsed : [];
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
  
  return callId;
} 