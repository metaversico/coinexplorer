import { Application, Router } from "jsr:@oak/oak";
import { parse } from "jsr:@std/yaml";

const JOBSCHEDULE_PATH = new URL("../jobschedule.yml", import.meta.url).pathname;

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

const app = new Application();

// Request logging middleware
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  const { method, url } = ctx.request;
  const status = ctx.response.status;
  console.log(`${method} ${url.pathname} -> ${status} (${ms}ms)`);
});

app.use(router.routes());
app.use(router.allowedMethods());

export default app