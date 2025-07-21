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

  interface TokenChange {
    accountIndex: number;
    mint: string;
    owner: string;
    programId: string;
    decimals: number;
    preAmount: number;
    postAmount: number;
    change: number;
    uiPreAmount: number;
    uiPostAmount: number;
    uiChange: number;
  }

  const getTokenChanges = (): TokenChange[] => {
    if (!transaction?.result?.meta?.preTokenBalances || !transaction?.result?.meta?.postTokenBalances) {
      return [];
    }

    const preBalances = transaction.result.meta.preTokenBalances;
    const postBalances = transaction.result.meta.postTokenBalances;
    const changes: TokenChange[] = [];

    // Create a map of preBalances by accountIndex for quick lookup
    const preBalanceMap = new Map();
    preBalances.forEach((balance: any) => {
      preBalanceMap.set(balance.accountIndex, balance);
    });

    // Compare post balances with pre balances
    postBalances.forEach((postBalance: any) => {
      const preBalance = preBalanceMap.get(postBalance.accountIndex);
      if (preBalance) {
        const preAmount = parseFloat(preBalance.uiTokenAmount.amount);
        const postAmount = parseFloat(postBalance.uiTokenAmount.amount);
        const change = postAmount - preAmount;
        
        if (change !== 0) {
          changes.push({
            accountIndex: postBalance.accountIndex,
            mint: postBalance.mint,
            owner: postBalance.owner,
            programId: postBalance.programId,
            decimals: postBalance.uiTokenAmount.decimals,
            preAmount: preAmount,
            postAmount: postAmount,
            change: change,
            uiPreAmount: preBalance.uiTokenAmount.uiAmount,
            uiPostAmount: postBalance.uiTokenAmount.uiAmount,
            uiChange: postBalance.uiTokenAmount.uiAmount - preBalance.uiTokenAmount.uiAmount
          });
        }
      }
    });

    return changes;
  };

  const renderTokenChanges = () => {
    const tokenChanges = getTokenChanges();
    
    if (tokenChanges.length === 0) {
      return null;
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>Token Changes</CardTitle>
          <CardDescription>Token balance changes from this transaction</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {tokenChanges.map((change, index) => (
              <div key={index} className="border rounded-lg p-4 bg-muted/30">
                <div className="grid gap-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm">Account Index: {change.accountIndex}</div>
                    <div className={`text-sm font-medium ${change.uiChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {change.uiChange > 0 ? '+' : ''}{change.uiChange.toLocaleString('en-US', { maximumFractionDigits: change.decimals })}
                    </div>
                  </div>
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Token Mint:</span>
                      <span className="font-mono break-all">{change.mint}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Owner:</span>
                      <span className="font-mono break-all">{change.owner}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Program:</span>
                      <span className="font-mono break-all">{change.programId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Pre-Balance:</span>
                      <span>{change.uiPreAmount?.toLocaleString('en-US', { maximumFractionDigits: change.decimals })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Post-Balance:</span>
                      <span>{change.uiPostAmount?.toLocaleString('en-US', { maximumFractionDigits: change.decimals })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Raw Change:</span>
                      <span className="font-mono">{change.change.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
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
          <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm break-all whitespace-pre-wrap">
            {formatJson(transaction.params)}
          </pre>
        </CardContent>
      </Card>

      {transaction.method === 'getTransaction' && transaction.result && renderTokenChanges()}

      {transaction.result && (
        <Card>
          <CardHeader>
            <CardTitle>Result</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm break-all whitespace-pre-wrap">
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