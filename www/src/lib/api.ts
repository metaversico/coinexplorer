import { Transaction } from '@/types';

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

export async function fetchTransaction(id: string): Promise<Transaction> {
  const response = await fetch(`${API_BASE_URL}/api/transactions/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch transaction');
  }
  return response.json();
}