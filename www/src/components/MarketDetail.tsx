import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { MarketDetails } from '@/types';
import { fetchMarket } from '@/lib/api';

export function MarketDetail() {
  const { address } = useParams<{ address: string }>();
  const [market, setMarket] = useState<MarketDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMarket() {
      if (!address) return;
      try {
        const data = await fetchMarket(address);
        setMarket(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    }

    loadMarket();
  }, [address]);

  if (loading) {
    return <div>Loading market details...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!market) {
    return <div>Market not found.</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">{market.name}</h1>
      <div className="border p-4 rounded-lg shadow">
        <p><strong>Chain:</strong> {market.chain}</p>
        <p><strong>Type:</strong> {market.type}</p>
        <p><strong>Address:</strong> {market.address}</p>
      </div>
      <div className="mt-4">
        <h2 className="text-xl font-bold mb-2">Metadata</h2>
        <pre className="bg-gray-100 p-4 rounded-lg">
          {JSON.stringify(market.metadata, null, 2)}
        </pre>
      </div>
    </div>
  );
}
