import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CoinDetails } from '@/types';
import { fetchCoin } from '@/lib/api';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString();
}

function getAge(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return `${diffDays} days`;
}

export function CoinDetail() {
  const { ticker } = useParams<{ ticker: string }>();
  const [coin, setCoin] = useState<CoinDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCoin() {
      if (!ticker) return;
      try {
        const data = await fetchCoin(ticker);
        setCoin(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    }
    loadCoin();
  }, [ticker]);

  useEffect(() => {
    if (!coin) return;
    async function renderChart() {
      // @ts-ignore - Using CDN module for demo purposes
      const Chart = (await import('https://cdn.jsdelivr.net/npm/chart.js@4.3.0/dist/chart.umd.js')).default;
      const ctx = document.getElementById('coin-chart') as HTMLCanvasElement;
      if (ctx) {
        new Chart(ctx, {
          type: 'line',
          data: {
            labels: coin.price_history.map((p) => p.date),
            datasets: [
              {
                label: 'USD Price',
                data: coin.price_history.map((p) => p.price),
              },
            ],
          },
        });
      }
    }
    renderChart();
  }, [coin]);

  if (loading) {
    return <div>Loading coin...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!coin) {
    return <div>Coin not found.</div>;
  }

  const unifiedPrice =
    coin.markets.reduce((acc, m) => acc + m.price, 0) / coin.markets.length;

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center mb-4">
        <img src={coin.image} alt={`${coin.name} logo`} className="w-16 h-16 mr-4" />
        <div>
          <h1 className="text-2xl font-bold">
            {coin.name} ({coin.ticker})
          </h1>
          <p className="text-sm text-gray-600">{coin.chain}</p>
          <p className="text-sm">Address: {coin.address}</p>
          <p className="text-sm">
            Created: {formatDate(coin.created_at)} ({getAge(coin.created_at)} old)
          </p>
          <p className="text-sm">Unified USD Price: ${unifiedPrice.toFixed(2)}</p>
          <div className="flex space-x-2 mt-2">
            <a href={coin.website} className="text-blue-500" target="_blank" rel="noopener noreferrer">
              Website
            </a>
            {Object.entries(coin.socials).map(([name, url]) => (
              <a
                key={name}
                href={url}
                className="text-blue-500 capitalize"
                target="_blank"
                rel="noopener noreferrer"
              >
                {name}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-8">
        <canvas id="coin-chart" height="100"></canvas>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-bold mb-2">Markets</h2>
        <ul>
          {coin.markets.map((m) => (
            <li key={m.name} className="flex justify-between">
              <span>{m.name}</span>
              <span>${m.price}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-2">Recent Transactions</h2>
        <ul>
          {coin.transactions.map((t) => (
            <li key={t.id} className="flex justify-between text-sm border-b py-1">
              <span>{t.type}</span>
              <span>{t.amount}</span>
              <span>{new Date(t.timestamp).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
