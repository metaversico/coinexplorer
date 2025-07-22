import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ExternalLink, Copy, Check, Loader2 } from 'lucide-react';
import { fetchTransaction } from '@/lib/api';
import { Transaction } from '@/types';

export function TransactionDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [polling, setPolling] = useState(false);
  const [pollCount, setPollCount] = useState(0);

  const isSeeking = searchParams.get('seeking') === 'true';
  const maxPolls = 40; // 40 polls * 1.5 seconds = 60 seconds max

  useEffect(() => {
    if (id) {
      loadTransaction();
    }
  }, [id]);

  useEffect(() => {
    let intervalId: number | null = null;

    if (isSeeking && !transaction && !error && pollCount < maxPolls) {
      setPolling(true);
      intervalId = setInterval(() => {
        setPollCount(prev => {
          const newCount = prev + 1;
          if (newCount >= maxPolls) {
            setPolling(false);
            setError('Transaction fetch timeout. Please try again later.');
          }
          return newCount;
        });
        loadTransaction();
      }, 1500); // Poll every 1.5 seconds
    } else {
      setPolling(false);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isSeeking, transaction, error, pollCount]);

  useEffect(() => {
    // If we successfully loaded the transaction while seeking, remove the seeking param
    if (isSeeking && transaction) {
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('seeking');
      setSearchParams(newSearchParams, { replace: true });
      setPolling(false);
    }
  }, [transaction, isSeeking, searchParams, setSearchParams]);

  const loadTransaction = async () => {
    if (!id) return;
    
    try {
      if (!polling) setLoading(true);
      const data = await fetchTransaction(id);
      setTransaction(data);
      setError(null);
    } catch (err) {
      if (!polling) {
        setError(err instanceof Error ? err.message : 'Failed to load transaction');
      }
      // If polling and we get an error, continue polling (transaction might not be ready yet)
    } finally {
      if (!polling) setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatJson = (obj: any) => {
    return JSON.stringify(obj, null, 2);
  };

  const copyToClipboard = async (data: any) => {
    try {
      const formattedJson = formatJson(data);
      await navigator.clipboard.writeText(formattedJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
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

    // Get account keys for address lookup
    const accountKeys = transaction?.result?.transaction?.message?.accountKeys || [];
    
    // Helper function to get account address from index
    const getAccountAddress = (accountIndex: number) => {
      return accountKeys[accountIndex]?.pubkey || `Account ${accountIndex}`;
    };

    // Find the fee payer (first signer, typically at index 0)
    const feePayer = accountKeys.find((account: any) => account.signer)?.pubkey;

    // Group token changes by owner address only
    const groupedChanges = tokenChanges.reduce((acc, change) => {
      if (!acc[change.owner]) {
        acc[change.owner] = [];
      }
      acc[change.owner].push(change);
      return acc;
    }, {} as Record<string, TokenChange[]>);

    // Sort groups to show fee payer first
    const sortedGroups = Object.entries(groupedChanges).sort(([ownerA], [ownerB]) => {
      if (ownerA === feePayer) return -1;
      if (ownerB === feePayer) return 1;
      return 0;
    });

    return (
      <Card>
        <CardHeader>
          <CardTitle>Token Changes</CardTitle>
          <CardDescription>Token balance changes grouped by owner address</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {sortedGroups.map(([owner, changes]) => (
              <div key={owner} className="border rounded-lg p-4 bg-muted/30">
                <div className="mb-4">
                  <div className="font-medium text-sm mb-1">Owner Address</div>
                  <div className="font-mono text-xs break-all text-muted-foreground">{owner}</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 font-medium">Account</th>
                        <th className="text-left py-2 font-medium">Token</th>
                        <th className="text-right py-2 font-medium">Pre</th>
                        <th className="text-right py-2 font-medium">Post</th>
                        <th className="text-right py-2 font-medium">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {changes.map((change, index) => (
                        <tr key={index} className="border-b border-muted-foreground/10">
                          <td className="py-3">
                            <div className="font-mono text-xs break-all">{getAccountAddress(change.accountIndex)}</div>
                          </td>
                          <td className="py-3">
                            <div className="font-mono text-xs break-all">{change.mint}</div>
                          </td>
                          <td className="py-3 text-right">
                            {change.uiPreAmount?.toLocaleString('en-US', { maximumFractionDigits: change.decimals })}
                          </td>
                          <td className="py-3 text-right">
                            {change.uiPostAmount?.toLocaleString('en-US', { maximumFractionDigits: change.decimals })}
                          </td>
                          <td className={`py-3 text-right font-medium ${change.uiChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {change.uiChange > 0 ? '+' : ''}{change.uiChange.toLocaleString('en-US', { maximumFractionDigits: change.decimals })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading || polling) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin" />
        <div className="text-lg">
          {isSeeking ? 'Seeking transaction...' : 'Loading transaction...'}
        </div>
        {polling && (
          <div className="text-sm text-muted-foreground text-center max-w-md">
            <p>The transaction is being fetched from the blockchain. This may take up to 60 seconds.</p>
            <p className="mt-2">Poll attempt: {pollCount} / {maxPolls}</p>
          </div>
        )}
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
          <CardDescription>
            {transaction.txn_signature ? (
              <>Transaction Signature: {transaction.txn_signature}</>
            ) : (
              <>ID: {transaction.id}</>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="font-medium mb-2">Basic Information</h3>
              <div className="space-y-2 text-sm">
                {transaction.txn_signature && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Transaction Signature:</span>
                    <span className="font-mono text-xs break-all">{transaction.txn_signature}</span>
                  </div>
                )}
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

      {transaction.txn_signature && (
        <Card>
          <CardHeader>
            <CardTitle>Context Links</CardTitle>
            <CardDescription>View this transaction on external services</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                asChild
                className="flex items-center gap-2"
              >
                <a
                  href={`https://solscan.io/tx/${transaction.txn_signature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3 w-3" />
                  View on Solscan
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Result</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(transaction.result)}
              className="flex items-center gap-2"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy JSON
                </>
              )}
            </Button>
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