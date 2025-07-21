import { parse } from "https://deno.land/std@0.208.0/yaml/mod.ts";

export interface RpcProvider {
  name: string;
  chain: string;
  url: string;
  interval: number;
}

export interface RpcProviderConfig {
  providers: RpcProvider[];
  defaults: {
    max_calls_per_provider: number;
    max_executions_per_interval: number;
    target_chain: string;
  };
}

export interface ProviderExecution {
  provider: RpcProvider;
  executionCount: number;
  intervalId?: number;
}

export class RpcProviderConfigLoader {
  private static instance: RpcProviderConfigLoader;
  private config: RpcProviderConfig | null = null;

  private constructor() {}

  static getInstance(): RpcProviderConfigLoader {
    if (!RpcProviderConfigLoader.instance) {
      RpcProviderConfigLoader.instance = new RpcProviderConfigLoader();
    }
    return RpcProviderConfigLoader.instance;
  }

  async loadConfig(configPath: string = "./rpc-providers.yml"): Promise<RpcProviderConfig> {
    try {
      const yamlContent = await Deno.readTextFile(configPath);
      this.config = parse(yamlContent) as RpcProviderConfig;
      
      // Validate configuration
      this.validateConfig(this.config);
      
      return this.config;
    } catch (error) {
      throw new Error(`Failed to load RPC provider configuration: ${error.message}`);
    }
  }

  getConfig(): RpcProviderConfig {
    if (!this.config) {
      throw new Error("Configuration not loaded. Call loadConfig() first.");
    }
    return this.config;
  }

  getProvidersForChain(chain: string): RpcProvider[] {
    const config = this.getConfig();
    return config.providers.filter(provider => provider.chain === chain);
  }

  getDefaultTargetChain(): string {
    return this.getConfig().defaults.target_chain;
  }

  getMaxCallsPerProvider(): number {
    return this.getConfig().defaults.max_calls_per_provider;
  }

  getMaxExecutionsPerInterval(): number {
    return this.getConfig().defaults.max_executions_per_interval;
  }

  private validateConfig(config: RpcProviderConfig): void {
    if (!config.providers || !Array.isArray(config.providers)) {
      throw new Error("Configuration must have a 'providers' array");
    }

    if (config.providers.length === 0) {
      throw new Error("At least one RPC provider must be configured");
    }

    for (const provider of config.providers) {
      if (!provider.name || !provider.chain || !provider.url || !provider.interval) {
        throw new Error(`Provider missing required fields: ${JSON.stringify(provider)}`);
      }
      
      if (provider.interval < 100) {
        throw new Error(`Provider interval too low (minimum 100ms): ${provider.name}`);
      }
    }

    if (!config.defaults) {
      throw new Error("Configuration must have a 'defaults' section");
    }

    if (!config.defaults.target_chain) {
      throw new Error("Default target_chain must be specified");
    }
  }
}