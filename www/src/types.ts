export interface Transaction {
  id: string;
  rpc_call_id: string;
  method: string;
  params: any;
  result: any;
  error: string | null;
  source_url?: string;
  created_at: string;
  completed_at: string | null;
  txn_signature?: string;
}