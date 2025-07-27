import HTTP from "./http/mod.ts";
import INIT from "./init/mod.ts";

import "jsr:@std/dotenv/load"

async function main() {
  await INIT();

  console.log('starting server')
  const port = Number(Deno.env.get("PORT")) || 8080;
  Deno.serve({ port }, HTTP.fetch);
  console.log(`adm/main started on port ${port}`);
}

main();