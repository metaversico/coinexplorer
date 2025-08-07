import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Copy, Check, Loader2 } from 'lucide-react';
import { fetchRpcRequest } from '@/lib/api';
import { RpcRequest } from '@/types';

export function RpcRequestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [rpcRequest, setRpcRequest] = useState<RpcRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (id) {
      loadRpcRequest();
    }
  }, [id]);

  const loadRpcRequest = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const data = await fetchRpcRequest(id);
      setRpcRequest(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load RPC request');
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin" />
        <div className="text-lg">Loading RPC request...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Button
          variant="outline"
          onClick={() => navigate('/rpc-requests')}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to RPC Requests
        </Button>
        <div className="flex items-center justify-center h-64">
          <div className="text-red-500">Error: {error}</div>
        </div>
      </div>
    );
  }

  if (!rpcRequest) {
    return (
      <div className="space-y-4">
        <Button
          variant="outline"
          onClick={() => navigate('/rpc-requests')}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to RPC Requests
        </Button>
        <div className="flex items-center justify-center h-64">
          <div>RPC Request not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button
        variant="outline"
        onClick={() => navigate('/rpc-requests')}
        className="flex items-center gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to RPC Requests
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>RPC Request Details</CardTitle>
          <CardDescription>
            ID: {rpcRequest.id}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* RPC Call Information Section */}
          <div>
            <h3 className="font-medium mb-3 text-base">RPC Call Information</h3>
            <div className="bg-muted/20 p-4 rounded-lg space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Method:</span>
                <span>{rpcRequest.method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created:</span>
                <span>{formatDate(rpcRequest.created_at)}</span>
              </div>
              {rpcRequest.completed_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Completed:</span>
                  <span>{formatDate(rpcRequest.completed_at)}</span>
                </div>
              )}
              {rpcRequest.source_url && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Provider:</span>
                  <span className="font-mono text-xs">{rpcRequest.source_url}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <span className={rpcRequest.error ? 'text-red-500' : 'text-green-500'}>
                  {rpcRequest.error ? 'Error' : 'Success'}
                </span>
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
            {formatJson(rpcRequest.params)}
          </pre>
        </CardContent>
      </Card>

      {rpcRequest.result && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Result</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(rpcRequest.result)}
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
              {formatJson(rpcRequest.result)}
            </pre>
          </CardContent>
        </Card>
      )}

      {rpcRequest.error && (
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-red-50 border border-red-200 p-4 rounded-md">
              <p className="text-red-800 text-sm">{rpcRequest.error}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
