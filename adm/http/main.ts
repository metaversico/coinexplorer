import AMDHttp from "./mod.ts";
import { closeAllDbPools } from "../../db/cleanup.ts";

let abortController: AbortController | null = null;

import "jsr:@std/dotenv/load"

function setupSignalHandlers() {
  const signals: Deno.Signal[] = ["SIGINT", "SIGTERM"];
  
  for (const signal of signals) {
    Deno.addSignalListener(signal, async () => {
      console.log(`Received ${signal}, shutting down gracefully...`);
      
      if (abortController) {
        abortController.abort();
      }
      
      await closeAllDbPools();
      console.log("HTTP server and database pools closed");
      Deno.exit(0);
    });
  }
}

function main() {
  console.log("Starting adm/http");
  const port = Number(Deno.env.get("PORT")) || 8080;
  
  setupSignalHandlers();
  
  abortController = new AbortController();
  
  Deno.serve(
    { port, signal: abortController.signal },
    AMDHttp.fetch
  );
  console.log(`adm/http started on port ${port}`);
}

main();