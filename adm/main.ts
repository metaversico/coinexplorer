import HTTP from "./http/mod.ts";
import INIT from "./init/mod.ts";
import RUN from "./run/mod.ts";

INIT();

const port = Number(Deno.env.get("PORT")) || 8080;
HTTP.listen({ port });