export interface RpcCall {
  id: string;
  method: string;
  params: any;
  created_at: string;
}

export interface RpcRequest {
  method: string;
  params: any;
}

export interface RpcCallResult {
  id: string;
  rpc_call_id: string;
  source_url: string;
  result?: any;
  error?: string;
  created_at: string;
  completed_at?: string;
}

export interface RpcCallWithResults extends RpcCall {
  results: RpcCallResult[];
}

export interface RpcResponse {
  success: boolean;
  result?: any;
  error?: string;
  statusCode?: number;
}

export class RpcClient {
  private rateLimiters: Map<string, { lastCall: number; interval: number }> = new Map();

  constructor(private defaultRateLimitMs: number = 3000) {}

  async makeRpcCall(call: RpcCall, url: string, rateLimitKey?: string): Promise<RpcResponse> {
    // Apply rate limiting
    if (rateLimitKey) {
      await this.waitForRateLimit(rateLimitKey);
    }

    try {
      const response = await fetch(url, {
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

    console.log('--------------------------------');
    console.log("rateLimitKey", rateLimitKey);
    console.log(limiter);

    const timeSinceLastCall = Date.now() - limiter.lastCall;

    if (timeSinceLastCall < limiter.interval) {
      const waitTime = limiter.interval - timeSinceLastCall;

      console.log(Date.now(), "waiting", waitTime);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    limiter.lastCall = Date.now();
    console.log(Date.now(),'last call', limiter.lastCall);
    this.rateLimiters.set(rateLimitKey, limiter);
  }

  setRateLimit(key: string, intervalMs: number): void {
    this.rateLimiters.set(key, {
      lastCall: 0,
      interval: intervalMs,
    });
  }
} 