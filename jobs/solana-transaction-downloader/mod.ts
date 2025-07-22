import { getSignaturesWithoutTransactionData } from "../../db/rpc/mod.ts";
import { createReceipt } from "../../db/receipts/mod.ts";
import { createJobRun } from "../../db/mod.ts";
import { requestGetTransaction } from "../../src/solana/rpc/getTransaction/mod.ts";

const BATCH_SIZE = parseInt(Deno.env.get("SIGNATURE_BATCH_SIZE") || "100");
const REQUESTS_PER_RUN = parseInt(Deno.env.get("SOLANA_TXNS_REQUESTS_PER_RUN") || "100");

export default async function RunJob(params: { job: string; args: string[] }) {
  const jobId = await createJobRun(params.job);
  console.log(`Starting ${params.job} with job ID: ${jobId}`);

  try {
    let processedCount = 0;
    let errorCount = 0;

    const signatures = await getSignaturesWithoutTransactionData(BATCH_SIZE);
    console.log(`Found ${signatures.length} signatures without transaction data, will process up to ${REQUESTS_PER_RUN} requests`);

    for (const signature of signatures) {
      if (processedCount >= REQUESTS_PER_RUN) {
        console.log(`Reached limit of ${REQUESTS_PER_RUN} requests, exiting`);
        break;
      }

      try {
        const rpcCallId = await requestGetTransaction(signature.signature, jobId);
        console.log(`Requested transaction ${signature.signature}, created RPC call ${rpcCallId}`);
        
        await createReceipt(
          "solana-transaction-downloader",
          `signature/${signature.signature}`
        );

        processedCount++;
      } catch (error) {
        console.error(`Error processing signature ${signature.signature}:`, error);
        errorCount++;
      }
    }

    console.log(`Job completed: ${processedCount} processed, ${errorCount} errors`);
  } catch (error) {
    console.error(`Job failed:`, error);
    throw error;
  }
}