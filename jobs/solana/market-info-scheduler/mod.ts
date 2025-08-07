import { parse } from "jsr:@std/yaml";
import { createRpcCall } from "../../../db/rpc/mod.ts";

const MARKETS_YML_PATH = new URL("../../../markets.yml", import.meta.url).pathname;

interface Market {
  address: string;
  name: string;
  chain: string;
  type: string;
}

async function loadMarketsFromYml(): Promise<Market[]> {
  const yml = await Deno.readTextFile(MARKETS_YML_PATH);
  const marketsParsed = parse(yml);
  const markets = Array.isArray(marketsParsed) ? marketsParsed : [];
  return markets.filter((market: Market) => market.chain === "solana");
}

export default async function RunJob(params: { job: string; args: string[] }) {
  console.log("Starting Solana market info scheduler job - scheduling RPC calls");

  const markets = await loadMarketsFromYml();
  const callIds: string[] = [];

  for (const market of markets) {
    const callId = await createRpcCall({
      method: "getAccountInfo",
      params: [market.address, { encoding: "jsonParsed" }],
      source: "market-info-scheduler",
    });
    callIds.push(callId);
    console.log(`Scheduled RPC call for: ${market.name} (${market.address}) - ID: ${callId}`);
  }

  console.log(`Scheduled ${callIds.length} RPC calls for Solana market info`);
  console.log("RPC calls will be processed by the rpc-executor job");

  return {
    message: `Scheduled ${callIds.length} RPC calls for market info`,
    callIds,
  };
}
