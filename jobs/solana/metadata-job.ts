import { processAndStoreSolanaCoins } from "../../db/coins/mod.ts";

export default async function RunJob() {
  await processAndStoreSolanaCoins();
} 