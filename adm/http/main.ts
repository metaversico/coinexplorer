import AMDHttp from "./mod.ts";

function main() {
  console.log("Starting adm/http");
  const port = Number(Deno.env.get("PORT")) || 8080;
  AMDHttp.listen({ port });
  console.log(`adm/http started on port ${port}`);
}

main();