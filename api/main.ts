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

async function getTransactions(limit = 50, offset = 0, method?: string, sort = 'desc') {
  const client = await connectDB();
  try {
    // Build dynamic query
    let query = `
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
    `;
    
    const queryParams: any[] = [];
    let paramIndex = 1;
    
    // Add method filter if provided
    if (method) {
      query += ` AND rc.method = $${paramIndex}`;
      queryParams.push(method);
      paramIndex++;
    }
    
    // Add sorting
    const sortDirection = sort.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY rcr.created_at ${sortDirection}`;
    
    // Add pagination
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);
    
    console.log(query, queryParams);
    const result = await client.queryObject(query, queryParams);
    console.log(result.rows);
    
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
        return new Response(JSON.stringify({ 
          error: "Invalid method filter. Allowed methods: " + allowedMethods.join(', ') 
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Validate sort parameter
      const sortDirection = sort.toLowerCase();
      if (sortDirection !== 'asc' && sortDirection !== 'desc') {
        return new Response(JSON.stringify({ 
          error: "Invalid sort parameter. Must be 'asc' or 'desc'" 
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      console.log(`API Request: limit=${limit}, offset=${offset}, method=${method}, sort=${sortDirection}`);
      
      const transactions = await getTransactions(limit, offset, method, sortDirection);
      
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