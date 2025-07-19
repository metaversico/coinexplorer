import TestJob from "./test-job/mod.ts";
import SolanaMetadataJob from "./solana/metadata-job.ts";
import TestErrorJob from "./test-error/mod.ts";

export default {
  "test-job": TestJob,
  "solana-metadata": SolanaMetadataJob,
  "test-error": TestErrorJob,
};