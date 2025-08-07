import { RpcCallWithResults } from "../client.ts";
import { getCoinsPool, upsertMarket } from "../../../db/markets/mod.ts";

export async function processSolanaMarketResults(calls: RpcCallWithResults[]) {
  const pool = getCoinsPool();

  try {
    const marketCalls = calls.filter(call => call.method === 'getAccountInfo');

    if (marketCalls.length === 0) {
      console.log("No getAccountInfo calls for markets to process");
      return;
    }

    console.log(`Processing ${marketCalls.length} Solana market results`);

    for (const call of marketCalls) {
      try {
        const address = call.params[0];
        if (!address) {
          console.log(`Skipping call ${call.id}: no address in params`);
          continue;
        }

        const result = call.results?.find(r => r.result && !r.error)?.result;
        if (!result) {
          console.log(`Skipping call ${call.id}: no result data`);
          continue;
        }

        await upsertMarket(pool, address, result);

        console.log(`Processed market info for ${address}`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error processing market call ${call.id}: ${errorMessage}`);
      }
    }
  } finally {
    // The pool is managed by the job, so we don't end it here.
  }
}
