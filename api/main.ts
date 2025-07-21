import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { Client } from "@postgres";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

interface RpcCallResult {
  id: string;
  rpc_call_id: string;
  method: string;
  params: any;
  result: any;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

async function connectDB() {
  const client = new Client({
    hostname: Deno.env.get("POSTGRES_HOST") || "localhost",
    port: parseInt(Deno.env.get("POSTGRES_PORT") || "5432"),
    user: Deno.env.get("POSTGRES_USER") || "jobruns",
    password: Deno.env.get("POSTGRES_PASSWORD") || "jobruns",
    database: "jobruns",
  });
  await client.connect();
  return client;
}

async function getTransactions(limit = 50, offset = 0) {
  const client = await connectDB();
  try {
    const result = await client.queryObject(`
      SELECT 
        rcr.id,
        rcr.rpc_call_id,
        rc.method,
        rc.params,
        rcr.result,
        rcr.error,
        rcr.created_at,
        rcr.completed_at
      FROM rpc_call_results rcr
      JOIN rpc_calls rc ON rcr.rpc_call_id = rc.id
      WHERE rcr.result IS NOT NULL
      ORDER BY rcr.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    
    return result.rows;
  } finally {
    await client.end();
  }
}

async function getTransaction(id: string) {
  const client = await connectDB();
  try {
    const result = await client.queryObject(`
      SELECT 
        rcr.id,
        rcr.rpc_call_id,
        rc.method,
        rc.params,
        rcr.result,
        rcr.error,
        rcr.source_url,
        rcr.created_at,
        rcr.completed_at
      FROM rpc_call_results rcr
      JOIN rpc_calls rc ON rcr.rpc_call_id = rc.id
      WHERE rcr.id = $1
    `, [id]);
    
    return result.rows[0] || null;
  } finally {
    await client.end();
  }
}

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (url.pathname === "/api/transactions" && req.method === "GET") {
      const limit = parseInt(url.searchParams.get("limit") || "50");
      const offset = parseInt(url.searchParams.get("offset") || "0");
      
      const transactions = await getTransactions(limit, offset);
      
      return new Response(JSON.stringify(transactions), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    if (url.pathname.startsWith("/api/transactions/") && req.method === "GET") {
      const id = url.pathname.split("/")[3];
      const transaction = await getTransaction(id);
      
      if (!transaction) {
        return new Response("Transaction not found", {
          status: 404,
          headers: corsHeaders,
        });
      }
      
      return new Response(JSON.stringify(transaction), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    return new Response("Not Found", {
      status: 404,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("API Error:", error);
    return new Response("Internal Server Error", {
      status: 500,
      headers: corsHeaders,
    });
  }
}

const port = parseInt(Deno.env.get("PORT") || "8000");
console.log(`API server running on http://localhost:${port}`);
await serve(handler, { port });