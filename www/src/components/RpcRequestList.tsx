import { useState, useEffect, MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { fetchRpcRequests, RpcRequestFilters, fetchRpcMethods } from '@/lib/api';
import { RpcRequest } from '@/types';
import { ApiFilterBar } from './ApiFilterBar';

export function RpcRequestList() {
  const [rpcRequests, setRpcRequests] = useState<RpcRequest[]>([]);
  const [availableMethods, setAvailableMethods] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<RpcRequestFilters>({
    method: null,
    sortOrder: 'latest'
  });
  const navigate = useNavigate();

  const limit = 20;

  useEffect(() => {
    loadAvailableMethods();
  }, []);

  useEffect(() => {
    loadRpcRequests();
  }, [page, filters]);

  const loadAvailableMethods = async () => {
    try {
      const methods = await fetchRpcMethods();
      setAvailableMethods(methods);
    } catch (err) {
      // Not critical, we can proceed without it
      console.error("Failed to load available RPC methods", err);
    }
  };

  const loadRpcRequests = async () => {
    try {
      setLoading(true);
      const data = await fetchRpcRequests(limit, page * limit, filters);
      setRpcRequests(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load RPC requests');
    } finally {
      setLoading(false);
    }
  };

  const handleFiltersChange = (newFilters: RpcRequestFilters) => {
    setFilters(newFilters);
    setPage(0); // Reset to first page when filters change
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatMethod = (method: string) => {
    return method.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  };

  const handleCardClick = (rpcRequest: RpcRequest, event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('.compare-button')) {
      return;
    }
    navigate(`/rpc-request/${rpcRequest.id}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading RPC requests...</div>
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
        availableMethods={availableMethods}
      />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Recent RPC Requests</h2>
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
            disabled={rpcRequests.length < limit || loading}
          >
            Next
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {rpcRequests.map((rpcRequest) => (
          <Card
            key={rpcRequest.id}
            className="cursor-pointer hover:shadow-md transition-all"
            onClick={(event) => handleCardClick(rpcRequest, event)}
          >
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-base">
                    {formatMethod(rpcRequest.method)}
                  </CardTitle>
                  <CardDescription>
                    ID: {rpcRequest.id.substring(0, 8)}...
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
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
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span className={rpcRequest.error ? 'text-red-500' : 'text-green-500'}>
                    {rpcRequest.error ? 'Error' : 'Success'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {rpcRequests.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {filters.method ? `No ${filters.method} requests found` : 'No requests found'}
          </p>
        </div>
      )}
    </div>
  );
}
