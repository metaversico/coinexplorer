import { getRpcCallsBySource } from "../../db/rpc/mod.ts";
import { processSolanaMarketResults } from "../../src/rpc/processors/solana-markets.ts";
import { createReceipt, hasOriginProcessedTarget } from "../../db/receipts/mod.ts";

const PROCESSING_BATCH_SIZE = parseInt(Deno.env.get("RPC_PROCESSING_BATCH_SIZE") ?? "50", 10);
const SERVICE_NAME = "solana-market-info-processor";

export default async function RunJob() {
  console.log(`Starting ${SERVICE_NAME} job`);

  const marketCalls = await getRpcCallsBySource("market-info-scheduler", PROCESSING_BATCH_SIZE);

  const filteredCalls = [];
  for (const call of marketCalls) {
    const alreadyProcessed = await hasOriginProcessedTarget(
      SERVICE_NAME,
      `rpc_call/${call.id}`
    );
    if (!alreadyProcessed) {
      filteredCalls.push(call);
    }
  }

  if (filteredCalls.length === 0) {
    console.log("No unprocessed Solana market info RPC calls to process");
    return;
  }

  console.log(`Processing ${filteredCalls.length} unprocessed Solana market info RPC calls`);

  await processSolanaMarketResults(filteredCalls);

  for (const call of filteredCalls) {
    try {
      await createReceipt(
        SERVICE_NAME,
        `rpc_call/${call.id}`
      );

      console.log(`Created receipt for processing RPC call ${call.id}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error creating receipt for call ${call.id}: ${errorMessage}`);
    }
  }
}
