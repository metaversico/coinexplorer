import TestJob from "./test-job/mod.ts";
import SolanaMetadataJob from "./solana/metadata-job.ts";
import TestErrorJob from "./test-error/mod.ts";
import RpcExecutorJob from "./rpc-executor/mod.ts";
import RpcExecutorMultiJob from "./rpc-executor-multi/mod.ts";
import SolanaSignatureBackfillJob from "./solana/signature-backfill/mod.ts";
import SolanaSignatureProcessorJob from "./solana-signature-processor/mod.ts";
import SolanaMetadataProcessorJob from "./solana-metadata-processor/mod.ts";
import SolanaTransactionDownloaderJob from "./solana-transaction-downloader/mod.ts";
import SolanaMarketInfoSchedulerJob from "./solana/market-info-scheduler/mod.ts";
import SolanaMarketInfoProcessorJob from "./solana-market-info-processor/mod.ts";

export default {
  "test-job": TestJob,
  "solana-metadata": SolanaMetadataJob,
  "solana-market-info-scheduler": SolanaMarketInfoSchedulerJob,
  "solana-market-info-processor": SolanaMarketInfoProcessorJob,
  "test-error": TestErrorJob,
  "rpc-executor": RpcExecutorJob,
  "rpc-executor-multi": RpcExecutorMultiJob,
  "solana-signature-backfill": SolanaSignatureBackfillJob,
  "solana-signature-processor": SolanaSignatureProcessorJob,
  "solana-metadata-processor": SolanaMetadataProcessorJob,
  "solana-transaction-downloader": SolanaTransactionDownloaderJob,
};