import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Market } from '@/types';
import { fetchMarkets, createMarket } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function MarketList() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMarket, setNewMarket] = useState({
    name: '',
    chain: 'solana',
    type: '',
    address: '',
  });
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    loadMarkets();
  }, []);

  async function loadMarkets() {
    try {
      setLoading(true);
      const data = await fetchMarkets();
      setMarkets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewMarket((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    if (!newMarket.name || !newMarket.chain || !newMarket.type || !newMarket.address) {
      setAddError('All fields are required');
      return;
    }

    try {
      const createdMarket = await createMarket(newMarket);
      setMarkets((prev) => [...prev, createdMarket]);
      setShowAddForm(false);
      setNewMarket({ name: '', chain: 'solana', type: '', address: '' });
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'An unknown error occurred');
    }
  };

  if (loading) {
    return <div>Loading markets...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Markets</h1>
        <Button onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? 'Cancel' : 'Add Market'}
        </Button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="mb-8 p-4 border rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Add New Market</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" value={newMarket.name} onChange={handleInputChange} placeholder="e.g. GOGO/SOL" />
            </div>
            <div>
              <Label htmlFor="chain">Chain</Label>
              <Input id="chain" name="chain" value={newMarket.chain} onChange={handleInputChange} disabled />
            </div>
            <div>
              <Label htmlFor="type">Type</Label>
              <Input id="type" name="type" value={newMarket.type} onChange={handleInputChange} placeholder="e.g. raydium-cpmm" />
            </div>
            <div>
              <Label htmlFor="address">Address</Label>
              <Input id="address" name="address" value={newMarket.address} onChange={handleInputChange} />
            </div>
          </div>
          <div className="mt-4">
            <Button type="submit">Create Market</Button>
          </div>
          {addError && <p className="text-red-500 mt-2">{addError}</p>}
        </form>
      )}

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
