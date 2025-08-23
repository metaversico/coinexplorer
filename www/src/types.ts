export interface Transaction {
  id: string;
  rpc_call_id: string;
  method: string;
  params: any;
  result: any;
  error: string | null;
  source_url?: string; // Now stores provider name instead of full URL
  created_at: string;
  completed_at: string | null;
  txn_signature?: string;
}

export interface RpcRequest {
  id: string;
  method: string;
  params: any;
  result: any;
  error: string | null;
  source_url?: string;
  created_at: string;
  completed_at: string | null;
}

export interface Market {
  name: string;
  chain: string;
  type: string;
  address: string;
}

export interface MarketDetails extends Market {
  metadata: any;
}

export interface CoinMarket {
  name: string;
  price: number; // Market-specific price in USD
}

export interface CoinTransaction {
  id: string;
  type: string; // e.g. swap, transfer
  amount: number;
  timestamp: string;
}

export interface PricePoint {
  date: string;
  price: number;
}

export interface CoinDetails {
  ticker: string;
  name: string;
  chain: string;
  address: string;
  created_at: string;
  image: string;
  website: string;
  socials: Record<string, string>;
  markets: CoinMarket[];
  price_history: PricePoint[];
  transactions: CoinTransaction[];
}