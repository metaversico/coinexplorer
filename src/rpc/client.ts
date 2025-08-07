export interface RpcCall {
  id: string;
  method: string;
  params: any;
  created_at: string;
}

export interface RpcRequest {
  method: string;
  params: any;
  source?: string;
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
  constructor() {}

  async makeRpcCall(call: RpcCall, url: string): Promise<RpcResponse> {

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

} 