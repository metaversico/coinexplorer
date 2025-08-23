import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Search, Loader2 } from 'lucide-react';
import { seekTransaction } from '@/lib/api';

export function SeekTransaction() {
  const navigate = useNavigate();
  const [signature, setSignature] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!signature.trim()) {
      setError('Transaction signature is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await seekTransaction(signature.trim());
      
      if (response.status === 'exists' && response.transaction) {
        // Transaction already exists, navigate directly to it
        navigate(`/transaction/${response.signature}`);
      } else if (response.status === 'pending') {
        // Transaction is being processed, navigate to polling page
        navigate(`/transaction/${response.signature}?seeking=true`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to seek transaction');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSignature(e.target.value);
    if (error) setError(null); // Clear error when user starts typing
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Seek Transaction
        </CardTitle>
        <CardDescription>
          Enter a transaction signature to load it on demand. If the transaction isn't in our database, 
          we'll fetch it and you'll be redirected to view it once it's available.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="signature" className="block text-sm font-medium mb-2">
              Transaction Signature
            </label>
            <input
              id="signature"
              type="text"
              value={signature}
              onChange={handleInputChange}
              placeholder="Enter transaction signature (e.g., 5VfYmGC5...)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              disabled={loading}
            />
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 p-3 rounded-md">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}
          
          <Button 
            type="submit" 
            disabled={loading || !signature.trim()}
            className="w-full flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Seeking Transaction...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Seek Transaction
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}