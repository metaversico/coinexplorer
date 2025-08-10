import { Transaction, RpcRequest, Market, MarketDetails, CoinDetails } from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export type SortOrder = 'latest' | 'earliest';

export interface TransactionFilters {
  method?: string | null;
  sortOrder?: SortOrder;
}

export async function fetchTransactions(
  limit = 50, 
  offset = 0, 
  filters?: TransactionFilters
): Promise<Transaction[]> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });

  // Add method filter if provided
  if (filters?.method) {
    params.append('method', filters.method);
  }

  // Add sort order if provided
  if (filters?.sortOrder) {
    params.append('sort', filters.sortOrder === 'latest' ? 'desc' : 'asc');
  }

  const response = await fetch(`${API_BASE_URL}/api/transactions?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch transactions');
  }
  return response.json();
}

export async function fetchMarket(address: string): Promise<MarketDetails> {
  const response = await fetch(`${API_BASE_URL}/api/market/${address}`);
  if (!response.ok) {
    throw new Error('Failed to fetch market details');
  }
  return response.json();
}

export async function fetchMarkets(): Promise<Market[]> {
  const response = await fetch(`${API_BASE_URL}/api/markets`);
  if (!response.ok) {
    throw new Error('Failed to fetch markets');
  }
  return response.json();
}

// TODO: Replace mock implementation with real API call once backend is ready
export async function fetchCoin(ticker: string): Promise<CoinDetails> {
  // Simulate network delay
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        ticker,
        name: 'Mock Coin',
        chain: 'Ethereum',
        address: '0x1234567890abcdef',
        created_at: '2023-01-01T00:00:00Z',
        image: 'https://via.placeholder.com/64',
        website: 'https://example.com',
        socials: {
          twitter: 'https://twitter.com/example',
          github: 'https://github.com/example',
        },
        markets: [
          { name: 'MarketA', price: 1.23 },
          { name: 'MarketB', price: 1.25 },
        ],
        price_history: [
          { date: '2024-01-01', price: 1.0 },
          { date: '2024-02-01', price: 1.1 },
          { date: '2024-03-01', price: 1.2 },
          { date: '2024-04-01', price: 1.3 },
        ],
        transactions: [
          { id: 'tx1', type: 'swap', amount: 100, timestamp: '2024-05-01T12:00:00Z' },
          { id: 'tx2', type: 'transfer', amount: 50, timestamp: '2024-05-02T15:30:00Z' },
        ],
      });
    }, 300);
  });
}

export async function fetchRpcRequest(id: string): Promise<RpcRequest> {
  const response = await fetch(`${API_BASE_URL}/api/rpc-requests/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch rpc request');
  }
  return response.json();
}

export async function fetchRpcMethods(): Promise<string[]> {
  const response = await fetch(`${API_BASE_URL}/api/rpc-methods`);
  if (!response.ok) {
    throw new Error('Failed to fetch rpc methods');
  }
  return response.json();
}

export interface RpcRequestFilters {
  method?: string | null;
  sortOrder?: SortOrder;
}

export async function fetchRpcRequests(
  limit = 50,
  offset = 0,
  filters?: RpcRequestFilters
): Promise<RpcRequest[]> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });

  if (filters?.method) {
    params.append('method', filters.method);
  }

  if (filters?.sortOrder) {
    params.append('sort', filters.sortOrder === 'latest' ? 'desc' : 'asc');
  }

  const response = await fetch(`${API_BASE_URL}/api/rpc-requests?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch rpc requests');
  }
  return response.json();
}

export async function fetchTransaction(id: string): Promise<Transaction> {
  const response = await fetch(`${API_BASE_URL}/api/transactions/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch transaction');
  }
  return response.json();
}

export interface SeekTransactionResponse {
  signature: string;
  status: 'exists' | 'pending';
  transaction?: Transaction;
  rpc_call_id?: string;
  message?: string;
}

export async function seekTransaction(signature: string): Promise<SeekTransactionResponse> {
  const response = await fetch(`${API_BASE_URL}/api/seek`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ signature }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to seek transaction');
  }
  
  return response.json();
}