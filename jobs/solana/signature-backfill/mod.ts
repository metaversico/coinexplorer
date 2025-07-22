import { parse } from "jsr:@std/yaml";
import { createRpcCall } from "../../../db/rpc/mod.ts";
import { getMarketBackfillState } from "../../../db/signatures/mod.ts";
import { createReceipt } from "../../../db/receipts/mod.ts";

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
  const skippedMarkets: string[] = [];
  
  // Process each market - use receipt-based state management per market
  for (const market of solanaMarkets) {
    console.log(`Processing market: ${market.name} (${market.address})`);
    
    try {
      // Get the backfill state for this specific market from receipts
      const marketState = await getMarketBackfillState(market.name);
      
      switch (marketState.state) {
        case 'first_run':
          console.log(`First run for ${market.name}, scheduling initial call`);
          
          const initialCallId = await scheduleSignatureCall(market.address, runId);
          scheduledCalls.push(initialCallId);
          
          // Create a receipt to track this RPC call for future runs
          await createReceipt(
            `solana-signature-backfill/${market.name}`,
            `rpc_call/${initialCallId}`
          );
          
          console.log(`Scheduled initial signature call for ${market.name} - ID: ${initialCallId}`);
          break;
          
        case 'pending':
          console.log(`Pending RPC call for ${market.name}, skipping until results are available`);
          skippedMarkets.push(market.name);
          break;
          
        case 'ready':
          if (marketState.last_signature) {
            console.log(`Found last processed signature for ${market.name}: ${marketState.last_signature.substring(0, 8)}...`);
            
            // Schedule a request for this market's address using the last processed signature as 'before'
            const continueCallId = await scheduleSignatureCall(
              market.address, 
              runId, 
              marketState.last_signature
            );
            scheduledCalls.push(continueCallId);
            
            // Create a receipt to track this RPC call for future runs
            await createReceipt(
              `solana-signature-backfill/${market.name}`,
              `rpc_call/${continueCallId}`
            );
            
            console.log(`Scheduled continuation signature call for ${market.name} - ID: ${continueCallId}`);
          } else {
            console.log(`Ready but no signatures returned for ${market.name}, backfill may be complete`);
            skippedMarkets.push(market.name);
          }
          break;
      }
    } catch (error) {
      console.error(`Error processing market ${market.name}:`, error);
    }
  }
  
  console.log(`Solana signature backfill job completed. Scheduled ${scheduledCalls.length} calls, skipped ${skippedMarkets.length} markets.`);
  
  return {
    message: `Scheduled signature calls for ${scheduledCalls.length} markets, skipped ${skippedMarkets.length} pending markets`,
    markets: solanaMarkets.map(m => m.name),
    scheduledCalls,
    skippedMarkets,
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
    method: "getSignaturesForAddress",
    params,
  });
  
  return callId;
} 