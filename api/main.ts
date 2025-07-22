import { Application, Router } from "@oak/oak";
import { getTransactions, getTransaction, getTransactionBySignature, ApiTransactionResult } from "../db/rpc/mod.ts";
import { requestGetTransaction } from "../src/solana/rpc/getTransaction/mod.ts";

import "jsr:@std/dotenv/load"
const router = new Router();

// CORS middleware function
const corsMiddleware = async (ctx: any, next: any) => {
  ctx.response.headers.set("Access-Control-Allow-Origin", "*");
  ctx.response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  ctx.response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  
  if (ctx.request.method === "OPTIONS") {
    ctx.response.status = 200;
    return;
  }
  
  await next();
};

router.get("/api/transactions", async (ctx) => {
  try {
    const url = ctx.request.url;
    
    // Parse and validate parameters
    const limitParam = url.searchParams.get("limit");
    const offsetParam = url.searchParams.get("offset");
    const method = url.searchParams.get("method") || undefined;
    const sort = url.searchParams.get("sort") || "desc";
    
    const limit = Math.min(Math.max(parseInt(limitParam || "50"), 1), 100); // Clamp between 1-100
    const offset = Math.max(parseInt(offsetParam || "0"), 0); // Ensure non-negative
    
    // Validate method if provided (security check)
    const allowedMethods = ['getSignaturesForAddress', 'getTransaction'];
    if (method && !allowedMethods.includes(method)) {
      ctx.response.status = 400;
      ctx.response.body = { 
        error: "Invalid method filter. Allowed methods: " + allowedMethods.join(', ') 
      };
      return;
    }
    
    // Validate sort parameter
    const sortDirection = sort.toLowerCase();
    if (sortDirection !== 'asc' && sortDirection !== 'desc') {
      ctx.response.status = 400;
      ctx.response.body = { 
        error: "Invalid sort parameter. Must be 'asc' or 'desc'" 
      };
      return;
    }
    
    console.log(`API Request: limit=${limit}, offset=${offset}, method=${method}, sort=${sortDirection}`);
    
    const transactions = await getTransactions(limit, offset, method, sortDirection);
    
    ctx.response.body = transactions;
  } catch (error) {
    console.error("API Error:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal Server Error" };
  }
});

router.get("/api/transactions/:id", async (ctx) => {
  try {
    const id = ctx.params.id;
    let transaction: ApiTransactionResult | null = null;

    
    // First try to get by signature (new way)
    if (id.length > 50) { // Transaction signatures are typically 87-88 characters
      transaction = await getTransactionBySignature(id);
    } else {
      transaction = await getTransaction(id);
    }
    
    if (!transaction) {
      ctx.response.status = 404;
      ctx.response.body = { error: "Transaction not found" };
      return;
    }
    
    ctx.response.body = transaction;
  } catch (error) {
    console.error("API Error:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal Server Error" };
  }
});

router.post("/api/seek", async (ctx) => {
  try {
    const body = ctx.request.body;
    const bodyType = body.type();
    if (bodyType !== "json") {
      ctx.response.status = 400;
      ctx.response.body = { error: "Content-Type must be application/json" };
      return;
    }
    
    const { signature } = await body.json();
    
    if (!signature || typeof signature !== 'string') {
      ctx.response.status = 400;
      ctx.response.body = { error: "Transaction signature is required" };
      return;
    }
    
    // Validate signature format (Solana transaction signatures are base58 encoded, typically 87-88 characters)
    if (signature.length < 80 || signature.length > 90) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Invalid transaction signature format" };
      return;
    }
    
    // Check if transaction already exists
    const existingTransaction = await getTransactionBySignature(signature);
    if (existingTransaction) {
      ctx.response.body = { 
        signature,
        status: "exists",
        transaction: existingTransaction 
      };
      return;
    }
    
    // Create RPC call for getTransaction
    const rpcCallId = await requestGetTransaction(signature);
    
    console.log(`Seeking transaction ${signature}, created RPC call ${rpcCallId}`);
    
    ctx.response.body = { 
      signature,
      status: "pending",
      rpc_call_id: rpcCallId,
      message: "Transaction lookup has been queued for processing"
    };
  } catch (error) {
    console.error("Seek API Error:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal Server Error" };
  }
});

const app = new Application();

app.use(corsMiddleware);
app.use(router.routes());
app.use(router.allowedMethods());

const port = parseInt(Deno.env.get("PORT") || "8000");
console.log(`API server running on http://localhost:${port}`);
await app.listen({ port });