import { createRpcCall } from "../../db/rpc/mod.ts";
import { getSignatures } from "../../db/signatures/mod.ts";
import { createReceipt, hasServiceProcessedResource } from "../../db/receipts/mod.ts";
import { createJobRun } from "../../db/mod.ts";

const SOLANA_RPC_URL = Deno.env.get("SOLANA_RPC_URL") || "https://api.mainnet-beta.solana.com";
const BATCH_SIZE = parseInt(Deno.env.get("SIGNATURE_BATCH_SIZE") || "100");
const MAX_ENCODING = "base64";

export default async function RunJob(params: { job: string; args: string[] }) {
  const jobId = await createJobRun(params.job);
  console.log(`Starting ${params.job} with job ID: ${jobId}`);

  try {
    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    const signatures = await getSignatures(BATCH_SIZE);
    console.log(`Found ${signatures.length} signatures to process`);

    for (const signature of signatures) {
      try {
        if (await hasServiceProcessedResource(
          "solana-transaction-downloader",
          "signature",
          signature.signature,
          "download"
        )) {
          skippedCount++;
          continue;
        }

        if (!signature.signature) {
          console.warn(`Skipping signature with missing signature field: ${signature.id}`);
          skippedCount++;
          continue;
        }

        await scheduleTransactionDownload(signature.signature, jobId);
        
        await createReceipt(
          "solana-transaction-downloader",
          "signature",
          signature.signature,
          "download",
          {
            signature_id: signature.id,
            processed_at: new Date().toISOString(),
          },
          jobId
        );

        processedCount++;
      } catch (error) {
        console.error(`Error processing signature ${signature.signature}:`, error);
        errorCount++;
      }
    }

    console.log(`Job completed: ${processedCount} processed, ${skippedCount} skipped, ${errorCount} errors`);
  } catch (error) {
    console.error(`Job failed:`, error);
    throw error;
  }
}

async function scheduleTransactionDownload(signature: string, jobId: string): Promise<string> {
  const params = [
    signature,
    {
      encoding: MAX_ENCODING,
      maxSupportedTransactionVersion: 0,
    }
  ];

  return await createRpcCall({
    method: "getTransaction",
    params,
    priority: 5,
    rate_limit_key: "solana-mainnet",
    job_id: jobId,
  });
}