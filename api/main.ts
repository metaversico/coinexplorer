import { Hono } from "hono";
import { cors } from "hono/cors";
import { getTransactions, getTransaction, getTransactionBySignature, ApiTransactionResult } from "../db/rpc/mod.ts";
import { requestGetTransaction } from "../src/solana/rpc/getTransaction/mod.ts";

import "jsr:@std/dotenv/load"
const app = new Hono();

app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type"],
}));

app.get("/api/transactions", async (c) => {
  try {
    const url = new URL(c.req.url);
    
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
      return c.json({ 
        error: "Invalid method filter. Allowed methods: " + allowedMethods.join(', ') 
      }, 400);
    }
    
    // Validate sort parameter
    const sortDirection = sort.toLowerCase();
    if (sortDirection !== 'asc' && sortDirection !== 'desc') {
      return c.json({ 
        error: "Invalid sort parameter. Must be 'asc' or 'desc'" 
      }, 400);
    }
    
    console.log(`API Request: limit=${limit}, offset=${offset}, method=${method}, sort=${sortDirection}`);
    
    const transactions = await getTransactions(limit, offset, method, sortDirection);
    
    return c.json(transactions);
  } catch (error) {
    console.error("API Error:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

app.get("/api/transactions/:id", async (c) => {
  try {
    const id = c.req.param("id");
    let transaction: ApiTransactionResult | null = null;

    
    // First try to get by signature (new way)
    if (id.length > 50) { // Transaction signatures are typically 87-88 characters
      transaction = await getTransactionBySignature(id);
    } else {
      transaction = await getTransaction(id);
    }
    
    if (!transaction) {
      return c.json({ error: "Transaction not found" }, 404);
    }
    
    return c.json(transaction);
  } catch (error) {
    console.error("API Error:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

app.post("/api/seek", async (c) => {
  try {
    const contentType = c.req.header("content-type");
    if (!contentType?.includes("application/json")) {
      return c.json({ error: "Content-Type must be application/json" }, 400);
    }
    
    const { signature } = await c.req.json();
    
    if (!signature || typeof signature !== 'string') {
      return c.json({ error: "Transaction signature is required" }, 400);
    }
    
    // Validate signature format (Solana transaction signatures are base58 encoded, typically 87-88 characters)
    if (signature.length < 80 || signature.length > 90) {
      return c.json({ error: "Invalid transaction signature format" }, 400);
    }
    
    // Check if transaction already exists
    const existingTransaction = await getTransactionBySignature(signature);
    if (existingTransaction) {
      return c.json({ 
        signature,
        status: "exists",
        transaction: existingTransaction 
      });
    }
    
    // Create RPC call for getTransaction
    const rpcCallId = await requestGetTransaction(signature);
    
    console.log(`Seeking transaction ${signature}, created RPC call ${rpcCallId}`);
    
    return c.json({ 
      signature,
      status: "pending",
      rpc_call_id: rpcCallId,
      message: "Transaction lookup has been queued for processing"
    });
  } catch (error) {
    console.error("Seek API Error:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

const port = parseInt(Deno.env.get("PORT") || "8000");
console.log(`API server running on http://localhost:${port}`);
Deno.serve({ port }, app.fetch);