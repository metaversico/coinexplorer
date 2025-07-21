import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { fetchTransaction } from '@/lib/api';
import { Transaction } from '@/types';

export function TransactionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadTransaction();
    }
  }, [id]);

  const loadTransaction = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const data = await fetchTransaction(id);
      setTransaction(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transaction');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatJson = (obj: any) => {
    return JSON.stringify(obj, null, 2);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading transaction...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Button
          variant="outline"
          onClick={() => navigate('/')}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Transactions
        </Button>
        <div className="flex items-center justify-center h-64">
          <div className="text-red-500">Error: {error}</div>
        </div>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="space-y-4">
        <Button
          variant="outline"
          onClick={() => navigate('/')}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Transactions
        </Button>
        <div className="flex items-center justify-center h-64">
          <div>Transaction not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button
        variant="outline"
        onClick={() => navigate('/')}
        className="flex items-center gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Transactions
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Transaction Details</CardTitle>
          <CardDescription>ID: {transaction.id}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="font-medium mb-2">Basic Information</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">RPC Call ID:</span>
                  <span className="font-mono">{transaction.rpc_call_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Method:</span>
                  <span>{transaction.method}</span>
                </div>
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
                {transaction.source_url && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Source URL:</span>
                    <span className="font-mono text-xs break-all">{transaction.source_url}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span className={transaction.error ? 'text-red-500' : 'text-green-500'}>
                    {transaction.error ? 'Error' : 'Success'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Parameters</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
            {formatJson(transaction.params)}
          </pre>
        </CardContent>
      </Card>

      {transaction.result && (
        <Card>
          <CardHeader>
            <CardTitle>Result</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
              {formatJson(transaction.result)}
            </pre>
          </CardContent>
        </Card>
      )}

      {transaction.error && (
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-red-50 border border-red-200 p-4 rounded-md">
              <p className="text-red-800 text-sm">{transaction.error}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}