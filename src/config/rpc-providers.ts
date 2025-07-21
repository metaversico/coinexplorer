import { parse } from "https://deno.land/std@0.208.0/yaml/mod.ts";

export interface RpcProvider {
  name: string;
  chain: string;
  url: string;
  interval: number;
  require?: Record<string, string>; // Maps template variables to environment variable names
}

export interface RpcProviderConfig {
  providers: RpcProvider[];
  defaults: {
    max_calls_per_provider: number;
    max_calls_per_provider_interval: number;
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
      
      // Process template variables and filter out providers with missing env vars
      this.processTemplateVariables(this.config);
      
      return this.config;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load RPC provider configuration: ${errorMessage}`);
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

  private processTemplateVariables(config: RpcProviderConfig): void {
    // Process each provider individually
    config.providers = config.providers.filter(provider => {
      // Skip providers without requirements
      if (!provider.require) {
        return true;
      }

      let processedUrl = provider.url;
      let hasAllRequiredVars = true;
      const missingVars: string[] = [];

      // Get environment variable values for this provider's requirements
      const envVars: Record<string, string> = {};
      for (const [templateVar, envVarName] of Object.entries(provider.require)) {
        const envValue = Deno.env.get(envVarName);
        if (envValue) {
          envVars[templateVar] = envValue;
        } else {
          missingVars.push(`${templateVar} (${envVarName})`);
          hasAllRequiredVars = false;
        }
      }

      // Log missing environment variables for this provider
      if (missingVars.length > 0) {
        console.warn(`Skipping provider '${provider.name}' due to missing environment variables: ${missingVars.join(', ')}`);
        return false;
      }

      // Replace template variables in URL
      for (const [templateVar, envValue] of Object.entries(envVars)) {
        const templatePattern = `{{${templateVar}}}`;
        processedUrl = processedUrl.replace(new RegExp(`\\{\\{${templateVar}\\}\\}`, 'g'), envValue);
      }

      // Check if there are still unresolved template variables
      const unresolvedTemplates = processedUrl.match(/\{\{[^}]+\}\}/g);
      if (unresolvedTemplates) {
        console.warn(`Skipping provider '${provider.name}' due to unresolved template variables: ${unresolvedTemplates.join(', ')}`);
        return false;
      }

      // Update the provider URL with resolved template variables
      provider.url = processedUrl;
      return true;
    });
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