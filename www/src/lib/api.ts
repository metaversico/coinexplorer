import { Transaction, RpcRequest } from '@/types';

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