import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Market } from '@/types';
import { fetchMarkets } from '@/lib/api';

export function MarketList() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMarkets() {
      try {
        const data = await fetchMarkets();
        setMarkets(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    }

    loadMarkets();
  }, []);

  if (loading) {
    return <div>Loading markets...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Markets</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {markets.map((market) => (
          <Link to={`/market/${market.address}`} key={market.address} className="border p-4 rounded-lg shadow hover:bg-gray-50">
            <h2 className="text-xl font-semibold">{market.name}</h2>
            <p>Chain: {market.chain}</p>
            <p>Type: {market.type}</p>
            <p className="text-sm text-gray-500 truncate">Address: {market.address}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
