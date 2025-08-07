import { RpcClient } from "../../src/rpc/client.ts";
import { fetchAndLockPendingRpcCalls, createRpcCallResult, unlockStaleRpcCalls } from "../../db/rpc/mod.ts";
import { RpcProviderConfigLoader, type RpcProvider, type ProviderExecution } from "../../src/config/rpc-providers.ts";

export default async function RunJob() {
  console.log("Starting multi-provider RPC executor job");

  // Unlock stale RPC calls that might be stuck in 'processing' state
  try {
    const unlockedCount = await unlockStaleRpcCalls(5); // 5 minutes
    if (unlockedCount > 0) {
      console.log(`Unlocked ${unlockedCount} stale RPC calls.`);
    }
  } catch (error) {
    console.error("Failed to unlock stale RPC calls:", error);
  }

  // Load configuration
  const configLoader = RpcProviderConfigLoader.getInstance();
  let config;
  try {
    config = await configLoader.loadConfig();
  } catch (error) {
    console.error("Failed to load RPC provider configuration:", error instanceof Error ? error.message : String(error));
    return;
  }

  const targetChain = Deno.env.get("TARGET_CHAIN") || config.defaults.target_chain;
  const maxCallsPerProvider = parseInt(Deno.env.get("MAX_CALLS_PER_PROVIDER") || config.defaults.max_calls_per_provider.toString(), 10);
  const maxCallsPerProviderInterval = parseInt(Deno.env.get("MAX_CALLS_PER_PROVIDER_INTERVAL") || config.defaults.max_calls_per_provider_interval.toString(), 10);

  console.log(`Target chain: ${targetChain}`);
  console.log(`Max calls per provider: ${maxCallsPerProvider}`);
  console.log(`Max calls per provider interval: ${maxCallsPerProviderInterval}`);

  // Get providers for the target chain
  const providers = configLoader.getProvidersForChain(targetChain);
  if (providers.length === 0) {
    console.log(`No providers configured for chain: ${targetChain}`);
    return;
  }

  console.log(`Found ${providers.length} providers for chain ${targetChain}:`);
  providers.forEach(p => console.log(`  - ${p.name} (${p.url}, interval: ${p.interval}ms)`));

  // Initialize RPC client
  const rpcClient = new RpcClient();

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
    const checkAllComplete = () => {
      if (completedProviders >= totalProviders) {
        console.log("All providers completed their executions. Exiting.");
        clearTimeout(timelimit);
        resolve();
      }
    };

    const executeForProvider = async (providerExecution: ProviderExecution) => {
      const { provider } = providerExecution;
      try {
        const calls = await fetchAndLockPendingRpcCalls(maxCallsPerProviderInterval);
        if (calls.length === 0) {
          console.log(`No more pending calls for provider ${provider.name}`);
          return;
        }

        console.log(`Executing ${calls.length} calls for provider ${provider.name} (execution ${providerExecution.executionCount + 1}/${maxCallsPerProvider})`);
        for (const call of calls) {
          try {
            console.log(`Executing RPC call ${call.id} to ${provider.url} (${call.method}) via ${provider.name}`);
            const response = await rpcClient.makeRpcCall(call, provider.url);
            if (response.success) {
              await createRpcCallResult(call.id, provider.name, response.result);
              console.log(`RPC call ${call.id} completed successfully via ${provider.name}`);
            } else {
              await createRpcCallResult(call.id, provider.name, undefined, response.error);
              console.log(`RPC call ${call.id} failed via ${provider.name}: ${response.error}`);
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            await createRpcCallResult(call.id, provider.name, undefined, `Unexpected error: ${errorMessage}`);
            console.error(`Unexpected error processing RPC call ${call.id} via ${provider.name}: ${errorMessage}`);
          }
        }
      } catch (error) {
        console.error(`Error executing calls for provider ${provider.name}:`, error);
      }

      providerExecution.executionCount++;
      if (providerExecution.executionCount >= maxCallsPerProvider) {
        console.log(`Provider ${provider.name} completed ${maxCallsPerProvider} executions. Stopping.`);
        if (providerExecution.intervalId !== undefined) {
          clearInterval(providerExecution.intervalId);
        }
        completedProviders++;
        checkAllComplete();
      }
    };

    providerExecutions.forEach(providerExecution => {
      const { provider } = providerExecution;
      executeForProvider(providerExecution); // Execute immediately
      console.log('setting up interval for provider', provider.name, Date.now(), provider.interval);
      providerExecution.intervalId = setInterval(() => {
        console.log('executing for provider', provider.name, Date.now());
        executeForProvider(providerExecution);
      }, provider.interval);
    });

    const timelimit = setTimeout(() => {
      console.log("Safety timeout reached. Forcing exit.");
      providerExecutions.forEach(pe => {
        if (pe.intervalId !== undefined) {
          clearInterval(pe.intervalId);
        }
      });
      resolve();
    }, 45 * 1000); // 45 seconds
  });
}