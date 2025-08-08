#!/usr/bin/env -S deno run --allow-net --allow-env

import { Command } from "@cliffy/command";

interface Market {
  name: string;
  address: string;
  [key: string]: unknown;
}

interface Transaction {
  created_at: string;
  result?: {
    transaction?: {
      message?: {
        accountKeys?: string[];
      };
    };
  };
}

const API_BASE = Deno.env.get("CXO_API") || "http://localhost:8000";

async function fetchJson(path: string) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    throw new Error(`API error ${res.status}`);
  }
  return res.json();
}

async function listMarkets(): Promise<Market[]> {
  return await fetchJson("/api/markets");
}

const command = new Command()
  .name("cxo")
  .version("0.1.0")
  .description("CoinExplorer CLI");

command
  .command("show <id:string>")
  .description("Show market information for address or ticker")
  .action(async (_opts, id) => {
    const markets = await listMarkets();
    const market = markets.find((m) =>
      m.address === id || m.name.toLowerCase().includes(id.toLowerCase())
    );
    if (!market) {
      console.error("Market not found");
      Deno.exit(1);
    }
    const detailed = await fetchJson(`/api/market/${market.address}`);
    console.log(JSON.stringify(detailed, null, 2));
  });

command
  .command("markets <id:string> [other:string]")
  .description("List markets matching one or two identifiers")
  .action(async (_opts, id, other) => {
    const markets = await listMarkets();
    const tokens = [id, other].filter(Boolean).map((s) => s.toLowerCase());
    const filtered = markets.filter((m) =>
      tokens.every((t) => m.address === t || m.name.toLowerCase().includes(t))
    );
    console.log(JSON.stringify(filtered, null, 2));
  });

command
  .command("swaps <id:string> [other:string]")
  .description("Show recent swaps for identifiers")
  .option("-f, --follow", "Follow swaps, polling periodically")
  .option("--after <date:string>", "Only show swaps after date (ISO)")
  .option("--before <date:string>", "Only show swaps before date (ISO)")
  .action(async (opts, id, other) => {
    const addresses = [id, other].filter(Boolean);
    let after = opts.after ? new Date(opts.after) : null;
    const before = opts.before ? new Date(opts.before) : null;

    async function query() {
      let txns: Transaction[] = await fetchJson(
        "/api/transactions?limit=50&method=getTransaction",
      );
      if (after) {
        txns = txns.filter((t) => new Date(t.created_at) > after!);
      }
      if (before) {
        txns = txns.filter((t) => new Date(t.created_at) < before);
      }
      if (addresses.length) {
        txns = txns.filter((t) =>
          addresses.every((addr) =>
            t.result?.transaction?.message?.accountKeys?.includes(addr)
          )
        );
      }
      if (txns.length) {
        console.log(JSON.stringify(txns, null, 2));
        const latest = Math.max(
          ...txns.map((t) => new Date(t.created_at).getTime()),
        );
        if (opts.follow) {
          after = new Date(latest);
        }
      }
    }

    await query();
    if (opts.follow) {
      while (true) {
        await new Promise((r) => setTimeout(r, 5000));
        await query();
      }
    }
  });

command
  .command("txn <sig:string>")
  .description("Fetch transaction by signature")
  .action(async (_opts, sig) => {
    const txn = await fetchJson(`/api/transactions/${sig}`);
    console.log(JSON.stringify(txn, null, 2));
  });

await command.parse(Deno.args);
