-- Connect to jobruns DB
\connect jobruns

DROP TABLE IF EXISTS rpc_calls;
CREATE TABLE rpc_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  method TEXT NOT NULL,
  params JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(method, params)
);

-- Indexes for efficient querying
CREATE INDEX idx_rpc_calls_created_at ON rpc_calls(created_at);

GRANT ALL PRIVILEGES ON TABLE rpc_calls TO jobruns; 