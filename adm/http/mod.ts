import { Application, Router } from "jsr:@oak/oak";
import { parse } from "jsr:@std/yaml";
import { Counter, Registry, collectDefaultMetrics } from "@prom-client";

const JOBSCHEDULE_PATH = new URL("../jobschedule.yml", import.meta.url).pathname;

// Prometheus metrics setup
const httpRequests = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "action", "status"],
});

const registry = new Registry();
registry.registerMetric(httpRequests);

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
  // collectDefaultMetrics({ register: registry }); errors in Deno due to perf_hooks.monitorEventLoopDelay throwing notImplemented
  ctx.response.status = 200;
  ctx.response.type = "text/plain";
  ctx.response.body = await registry.metrics();
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