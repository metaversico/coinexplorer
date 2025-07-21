import { Transaction } from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export async function fetchTransactions(limit = 50, offset = 0): Promise<Transaction[]> {
  const response = await fetch(`${API_BASE_URL}/api/transactions?limit=${limit}&offset=${offset}`);
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