import { useState, useEffect, MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Check } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { fetchTransactions, TransactionFilters } from '@/lib/api';
import { Transaction } from '@/types';
import { useComparison } from '../context/ComparisonContext';
import { ApiFilterBar } from './ApiFilterBar';

export function TransactionList() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<TransactionFilters>({
    method: null,
    sortOrder: 'latest'
  });
  const navigate = useNavigate();
  const { addTransaction, isSelected } = useComparison();

  const limit = 20;

  useEffect(() => {
    loadTransactions();
  }, [page, filters]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const data = await fetchTransactions(limit, page * limit, filters);
      setTransactions(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleFiltersChange = (newFilters: TransactionFilters) => {
    setFilters(newFilters);
    setPage(0); // Reset to first page when filters change
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatMethod = (method: string) => {
    return method.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  };

  const handleCardClick = (transaction: Transaction, event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('.compare-button')) {
      return;
    }
    navigate(`/transaction/${transaction.id}`);
  };

  const handleCompareClick = (transaction: Transaction, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    addTransaction(transaction);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading transactions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ApiFilterBar 
        filters={filters} 
        onFiltersChange={handleFiltersChange}
      />
      
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Recent Transactions</h2>
          <p className="text-sm text-gray-500 mt-1">
            {filters.method ? `Filtered by ${filters.method} method` : 'All methods'} • 
            Sorted by {filters.sortOrder === 'latest' ? 'latest first' : 'earliest first'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0 || loading}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            onClick={() => setPage(page + 1)}
            disabled={transactions.length < limit || loading}
          >
            Next
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {transactions.map((transaction) => (
          <Card
            key={transaction.id}
            className={`cursor-pointer hover:shadow-md transition-all ${
              isSelected(transaction.id) ? 'ring-2 ring-blue-500 bg-blue-50' : ''
            }`}
            onClick={(event) => handleCardClick(transaction, event)}
          >
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-base">
                    {formatMethod(transaction.method)}
                  </CardTitle>
                  <CardDescription>
                    ID: {transaction.id.substring(0, 8)}...
                  </CardDescription>
                </div>
                <Button
                  variant={isSelected(transaction.id) ? "default" : "outline"}
                  size="sm"
                  className="compare-button shrink-0"
                  onClick={(event) => handleCompareClick(transaction, event)}
                >
                  {isSelected(transaction.id) ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created:</span>
                  <span>{formatDate(transaction.created_at)}</span>
                </div>
                {transaction.completed_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Completed:</span>
                    <span>{formatDate(transaction.completed_at)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span className={transaction.error ? 'text-red-500' : 'text-green-500'}>
                    {transaction.error ? 'Error' : 'Success'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {transactions.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {filters.method ? `No ${filters.method} transactions found` : 'No transactions found'}
          </p>
        </div>
      )}
    </div>
  );
}