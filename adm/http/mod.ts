import { Application, Router } from "jsr:@oak/oak";
import { parse } from "jsr:@std/yaml";
import { Counter, Registry } from "@prom-client";
import { Pool } from "@postgres";

const JOBSCHEDULE_PATH = new URL("../jobschedule.yml", import.meta.url).pathname;

// Prometheus metrics setup
const httpRequests = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "action", "status"],
});

const registry = new Registry();
registry.registerMetric(httpRequests);

// Postgres pool setup (lazy, per-request)
function getPgPool() {
  const connStr = Deno.env.get("JOBRUNS_PG_CONN");
  if (!connStr) throw new Error("JOBRUNS_PG_CONN env not set");
  // Pool size 3, lazy
  return new Pool(connStr, 3, true);
}

const router = new Router();

router.get("/schedule", async (ctx) => {
  try {
    const yamlText = await Deno.readTextFile(JOBSCHEDULE_PATH);
    const jobs = parse(yamlText);
    ctx.response.status = 200;
    ctx.response.body = Array.isArray(jobs) ? jobs : { jobs };
  } catch (err) {
    ctx.response.status = 500;
    const msg = err instanceof Error ? err.message : String(err);
    ctx.response.body = { error: "Failed to read schedule", details: msg };
  }
});

// /metrics endpoint for Prometheus
router.get("/metrics", async (ctx) => {
  ctx.response.status = 200;
  ctx.response.type = "text/plain";
  ctx.response.body = await registry.metrics();
});

// GET /runs/:id endpoint
router.get("/runs/:id", async (ctx) => {
  const id = ctx.params.id;
  if (!id) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Missing id param" };
    return;
  }
  let pool;
  try {
    pool = getPgPool();
    const client = await pool.connect();
    try {
      // You may want to adjust the table/column names as per your schema
      const result = await client.queryObject<{ id: string }>(
        "SELECT * FROM job_runs WHERE id = $1",
        [id],
      );
      if (result.rows.length === 0) {
        ctx.response.status = 404;
        ctx.response.body = { error: "Run not found" };
      } else {
        ctx.response.status = 200;
        ctx.response.body = result.rows[0];
      }
    } finally {
      client.release();
    }
  } catch (err) {
    ctx.response.status = 500;
    const msg = err instanceof Error ? err.message : String(err);
    ctx.response.body = { error: "Failed to fetch run", details: msg };
  }
});

const app = new Application();

// Prometheus metrics middleware
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  const { method, url } = ctx.request;
  const status = ctx.response.status?.toString() || "0";
  // Use the first segment of the path as action, or full path
  const action = url.pathname.split("/")[1] || "/";
  httpRequests.labels({ method, action: `/${action}`, status }).inc();
  console.log(`${method} ${url.pathname} -> ${status} (${ms}ms)`);
});

app.use(router.routes());
app.use(router.allowedMethods());

export default app;