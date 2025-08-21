import { parse } from "jsr:@std/yaml";
import { createRpcCall } from "../../../db/rpc/mod.ts";
import { getMarketForwardFillState } from "../../../db/signatures/mod.ts";
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

  console.log("Starting Solana signature forward-fill job");

  // Load markets from YAML
  const markets = await loadMarketsFromYaml();
  const solanaMarkets = markets.filter(market => market.chain === "solana");

  console.log(`Found ${solanaMarkets.length} Solana markets to forward-fill`);

  const scheduledCalls: string[] = [];
  const skippedMarkets: string[] = [];

  // Process each market - use receipt-based state management per market
  for (const market of solanaMarkets) {
    console.log(`Processing market: ${market.name} (${market.address})`);

    try {
      // Get the forward-fill state for this specific market from receipts
      const marketState = await getMarketForwardFillState(market.name);

      switch (marketState.state) {
        case 'first_run':
          console.log(`First run for ${market.name}, scheduling initial call`);

          const initialCallId = await scheduleForwardSignatureCall(market.address, runId);
          scheduledCalls.push(initialCallId);

          // Create a receipt to track this RPC call for future runs
          await createReceipt(
            `solana-signature-forward-fill/${market.name}`,
            `rpc_call/${initialCallId}`
          );

          console.log(`Scheduled initial signature call for ${market.name} - ID: ${initialCallId}`);
          break;

        case 'pending':
          console.log(`Pending RPC call for ${market.name}, skipping until results are available`);
          skippedMarkets.push(market.name);
          break;

        case 'ready':
          if (marketState.next_signature) {
            console.log(`Found next processed signature for ${market.name}: ${marketState.next_signature.substring(0, 8)}...`);

            // Schedule a request for this market's address using the next processed signature as 'until'
            const continueCallId = await scheduleForwardSignatureCall(
              market.address,
              runId,
              marketState.next_signature
            );
            scheduledCalls.push(continueCallId);

            // Create a receipt to track this RPC call for future runs
            await createReceipt(
              `solana-signature-forward-fill/${market.name}`,
              `rpc_call/${continueCallId}`
            );

            console.log(`Scheduled continuation signature call for ${market.name} - ID: ${continueCallId}`);
          } else {
            console.log(`Ready but no new signature for ${market.name}, checking for new transactions.`);
            const refreshCallId = await scheduleForwardSignatureCall(market.address, runId);
            scheduledCalls.push(refreshCallId);

            await createReceipt(
              `solana-signature-forward-fill/${market.name}`,
              `rpc_call/${refreshCallId}`
            );

            console.log(`Scheduled refresh signature call for ${market.name} - ID: ${refreshCallId}`);
          }
          break;
      }
    } catch (error) {
      console.error(`Error processing market ${market.name}:`, error);
    }
  }

  console.log(`Solana signature forward-fill job completed. Scheduled ${scheduledCalls.length} calls, skipped ${skippedMarkets.length} markets.`);

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

async function scheduleForwardSignatureCall(
  address: string,
  jobId: string,
  until?: string
): Promise<string> {
  const params: [string, any] = [address, { limit: MAX_SIGNATURES_PER_CALL }];

  if (until) {
    params[1] = { limit: MAX_SIGNATURES_PER_CALL, until };
  }

  const callId = await createRpcCall({
    method: "getSignaturesForAddress",
    params,
  });

  return callId;
}
