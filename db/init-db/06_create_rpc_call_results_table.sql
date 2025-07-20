-- Connect to jobruns DB
\connect jobruns

DROP TABLE IF EXISTS rpc_call_results;
CREATE TABLE rpc_call_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rpc_call_id UUID NOT NULL REFERENCES rpc_calls(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Indexes for efficient querying
CREATE INDEX idx_rpc_call_results_rpc_call_id ON rpc_call_results(rpc_call_id);
CREATE INDEX idx_rpc_call_results_source_url ON rpc_call_results(source_url);
CREATE INDEX idx_rpc_call_results_created_at ON rpc_call_results(created_at);

GRANT ALL PRIVILEGES ON TABLE rpc_call_results TO jobruns;