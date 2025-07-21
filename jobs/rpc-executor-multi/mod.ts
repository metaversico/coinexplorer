import { RpcClient } from "../../src/rpc/client.ts";
import { getPendingRpcCallsForChain, createRpcCallResult } from "../../db/rpc/mod.ts";
import { RpcProviderConfigLoader, type RpcProvider, type ProviderExecution } from "../../src/config/rpc-providers.ts";

export default async function RunJob() {
  console.log("Starting multi-provider RPC executor job");
  
  // Load configuration
  const configLoader = RpcProviderConfigLoader.getInstance();
  let config;
  
  try {
    config = await configLoader.loadConfig();
  } catch (error) {
    console.error("Failed to load RPC provider configuration:", error.message);
    return;
  }
  
  const targetChain = Deno.env.get("TARGET_CHAIN") || config.defaults.target_chain;
  const maxCallsPerProvider = parseInt(Deno.env.get("MAX_CALLS_PER_PROVIDER") || config.defaults.max_calls_per_provider.toString(), 10);
  const maxExecutionsPerInterval = parseInt(Deno.env.get("MAX_EXECUTIONS_PER_INTERVAL") || config.defaults.max_executions_per_interval.toString(), 10);
  
  console.log(`Target chain: ${targetChain}`);
  console.log(`Max calls per provider: ${maxCallsPerProvider}`);
  console.log(`Max executions per interval: ${maxExecutionsPerInterval}`);
  
  // Get providers for the target chain
  const providers = configLoader.getProvidersForChain(targetChain);
  
  if (providers.length === 0) {
    console.log(`No providers configured for chain: ${targetChain}`);
    return;
  }
  
  console.log(`Found ${providers.length} providers for chain ${targetChain}:`);
  providers.forEach(p => console.log(`  - ${p.name} (${p.url}, interval: ${p.interval}ms)`));
  
  // Check if there are any pending calls for the target chain
  const allPendingCalls = await getPendingRpcCallsForChain(targetChain, maxCallsPerProvider * providers.length);
  
  if (allPendingCalls.length === 0) {
    console.log(`No pending RPC calls for chain: ${targetChain}`);
    return;
  }
  
  console.log(`Found ${allPendingCalls.length} pending RPC calls for chain ${targetChain}`);
  
  // Initialize RPC client with default rate limiting
  const rpcClient = new RpcClient(1000);
  
  // Set up rate limits for each provider
  providers.forEach(provider => {
    rpcClient.setRateLimit(provider.name, provider.interval);
  });
  
  // Initialize provider execution tracking
  const providerExecutions: ProviderExecution[] = providers.map(provider => ({
    provider,
    executionCount: 0,
    intervalId: undefined,
  }));
  
  // Track completion
  let completedProviders = 0;
  const totalProviders = providerExecutions.length;
  
  // Create a promise that resolves when all providers are done
  return new Promise<void>((resolve) => {
    // Function to check if all providers are done
    const checkAllComplete = () => {
      if (completedProviders >= totalProviders) {
        console.log("All providers completed their executions. Exiting.");
        resolve();
      }
    };
    
    // Function to execute RPC calls for a specific provider
    const executeForProvider = async (providerExecution: ProviderExecution) => {
      const { provider } = providerExecution;
      
      try {
        // Get pending calls for this provider (up to the limit)
        // Get pending calls that haven't been processed yet
        const availableCalls = allPendingCalls;
        
        const calls = availableCalls.slice(0, maxCallsPerProvider);
        
        if (calls.length === 0) {
          console.log(`No more pending calls for provider ${provider.name}`);
          return;
        }
        
        console.log(`Executing ${calls.length} calls for provider ${provider.name} (execution ${providerExecution.executionCount + 1}/${maxExecutionsPerInterval})`);
        
        // Process each call
        for (const call of calls) {
          try {
            console.log(`Executing RPC call ${call.id} to ${provider.url} (${call.method}) via ${provider.name}`);
            
            // Make the RPC call
            const response = await rpcClient.makeRpcCall(call, provider.url, provider.name);
            
            if (response.success) {
              // Store successful result
              await createRpcCallResult(call.id, provider.url, response.result);
              console.log(`RPC call ${call.id} completed successfully via ${provider.name}`);
            } else {
              // Store error result
              await createRpcCallResult(call.id, provider.url, undefined, response.error);
              console.log(`RPC call ${call.id} failed via ${provider.name}: ${response.error}`);
            }
            
            // Remove processed call from the list
            const callIndex = allPendingCalls.findIndex(c => c.id === call.id);
            if (callIndex !== -1) {
              allPendingCalls.splice(callIndex, 1);
            }
            
          } catch (error) {
            // Handle unexpected errors
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            // Store error result
            await createRpcCallResult(call.id, provider.url, undefined, `Unexpected error: ${errorMessage}`);
            console.error(`Unexpected error processing RPC call ${call.id} via ${provider.name}: ${errorMessage}`);
          }
        }
        
      } catch (error) {
        console.error(`Error executing calls for provider ${provider.name}:`, error);
      }
      
      // Increment execution count
      providerExecution.executionCount++;
      
      // Check if this provider has completed all executions
      if (providerExecution.executionCount >= maxExecutionsPerInterval) {
        console.log(`Provider ${provider.name} completed ${maxExecutionsPerInterval} executions. Stopping.`);
        
        // Clear the interval
        if (providerExecution.intervalId !== undefined) {
          clearInterval(providerExecution.intervalId);
        }
        
        // Mark this provider as completed
        completedProviders++;
        
        // Check if all providers are done
        checkAllComplete();
      }
    };
    
    // Start intervals for each provider
    providerExecutions.forEach(providerExecution => {
      const { provider } = providerExecution;
      
      // Execute immediately for the first time
      executeForProvider(providerExecution);
      
      // Set up interval for subsequent executions
      providerExecution.intervalId = setInterval(() => {
        executeForProvider(providerExecution);
      }, provider.interval);
    });
    
    // Safety timeout - exit after 5 minutes even if not all providers are done
    setTimeout(() => {
      console.log("Safety timeout reached. Forcing exit.");
      providerExecutions.forEach(pe => {
        if (pe.intervalId !== undefined) {
          clearInterval(pe.intervalId);
        }
      });
      resolve();
    }, 5 * 60 * 1000); // 5 minutes
  });
}