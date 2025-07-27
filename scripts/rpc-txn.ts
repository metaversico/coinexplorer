#!/usr/bin/env -S deno run --allow-env --allow-net --allow-read

import { createRpcCall, createRpcCallResult } from "../db/rpc/mod.ts";
import { RpcClient } from "../src/rpc/client.ts";
import { RpcProviderConfigLoader } from "../src/config/rpc-providers.ts";

import "jsr:@std/dotenv/load"

async function main() {
  const args = Deno.args;
  
  if (args.length === 0) {
    console.error("Usage: deno task rpc:txn <signature>");
    console.error("Example: deno task rpc:txn 5VfydkTWGBGo2q84EqXh6KGmGkCp7N6jU2F5w8K7cHNdJdYhN7H8EwZs7X7FaG8FvBQJ2YvF4vD5N6Gv9k");
    Deno.exit(1);
  }

  const signature = args[0];
  
  if (!signature || signature.length < 10) {
    console.error("Error: Invalid signature provided");
    console.error("Signature should be a valid Solana transaction signature");
    Deno.exit(1);
  }

  console.log(`🚀 High-priority transaction download: ${signature}`);

  try {
    // Load provider configuration
    const configLoader = RpcProviderConfigLoader.getInstance();
    await configLoader.loadConfig();
    
    // Get the high priority provider
    const highPriorityProvider = configLoader.getHighPriorityProvider();
    if (!highPriorityProvider) {
      console.error("❌ No high priority provider configured");
      console.error("   Add 'high_priority_provider' to defaults in rpc-providers.yml");
      Deno.exit(1);
    }

    console.log(`⚡ Using high-priority provider: ${highPriorityProvider.name}`);
    console.log(`📡 Provider URL: ${highPriorityProvider.url}`);

    // Create the RPC call record first
    const rpcRequest = {
      method: "getTransaction",
      params: [
        signature,
        {
          encoding: "jsonParsed",
          commitment: "confirmed",
          maxSupportedTransactionVersion: 0
        }
      ]
    };

    const rpcCallId = await createRpcCall(rpcRequest);
    console.log(`📝 RPC call record created: ${rpcCallId}`);

    // Execute the RPC call immediately using the high priority provider
    const rpcClient = new RpcClient();
    const rpcCall = {
      id: rpcCallId,
      method: rpcRequest.method,
      params: rpcRequest.params,
      created_at: new Date().toISOString()
    };

    console.log(`🔄 Executing RPC call immediately...`);
    
    const response = await rpcClient.makeRpcCall(rpcCall, highPriorityProvider.url);

    if (response.success) {
      // Store successful result
      await createRpcCallResult(rpcCallId, highPriorityProvider.name, response.result);
      console.log(`✅ Transaction downloaded successfully!`);
      console.log(`   RPC Call ID: ${rpcCallId}`);
      console.log(`   Provider: ${highPriorityProvider.name}`);
      console.log(`   Signature: ${signature}`);
      if (response.result?.meta?.err) {
        console.log(`   Transaction Status: FAILED (${JSON.stringify(response.result.meta.err)})`);
      } else {
        console.log(`   Transaction Status: SUCCESS`);
      }
    } else {
      // Store error result
      await createRpcCallResult(rpcCallId, highPriorityProvider.name, undefined, response.error);
      console.log(`❌ RPC call failed: ${response.error}`);
      console.log(`   RPC Call ID: ${rpcCallId}`);
      console.log(`   Provider: ${highPriorityProvider.name}`);
      Deno.exit(1);
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error: ${errorMessage}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}