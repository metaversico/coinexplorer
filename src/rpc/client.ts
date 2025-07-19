export interface RpcCall {
  id: string;
  url: string;
  method: string;
  params: any;
  status: 'pending' | 'running' | 'completed' | 'failed';
  priority: number;
  created_at: string;
  scheduled_at: string;
  executed_at?: string;
  completed_at?: string;
  result?: any;
  error?: string;
  retry_count: number;
  max_retries: number;
  rate_limit_key?: string;
  job_id?: string;
}

export interface RpcRequest {
  url: string;
  method: string;
  params: any;
  priority?: number;
  rate_limit_key?: string;
  job_id?: string;
}

export interface RpcResponse {
  success: boolean;
  result?: any;
  error?: string;
  statusCode?: number;
}

export class RpcClient {
  private rateLimiters: Map<string, { lastCall: number; interval: number }> = new Map();

  constructor(private defaultRateLimitMs: number = 1000) {}

  async makeRpcCall(call: RpcCall): Promise<RpcResponse> {
    // Apply rate limiting
    if (call.rate_limit_key) {
      await this.waitForRateLimit(call.rate_limit_key);
    }

    try {
      const response = await fetch(call.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: call.id,
          method: call.method,
          params: call.params,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          statusCode: response.status,
        };
      }

      if (data.error) {
        return {
          success: false,
          error: data.error.message || JSON.stringify(data.error),
          statusCode: response.status,
        };
      }

      return {
        success: true,
        result: data.result,
        statusCode: response.status,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async waitForRateLimit(rateLimitKey: string): Promise<void> {
    const limiter = this.rateLimiters.get(rateLimitKey) || {
      lastCall: 0,
      interval: this.defaultRateLimitMs,
    };

    const now = Date.now();
    const timeSinceLastCall = now - limiter.lastCall;

    if (timeSinceLastCall < limiter.interval) {
      const waitTime = limiter.interval - timeSinceLastCall;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    limiter.lastCall = Date.now();
    this.rateLimiters.set(rateLimitKey, limiter);
  }

  setRateLimit(key: string, intervalMs: number): void {
    this.rateLimiters.set(key, {
      lastCall: 0,
      interval: intervalMs,
    });
  }
} 