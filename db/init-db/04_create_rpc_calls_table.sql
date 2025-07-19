-- Connect to jobruns DB
\connect jobruns

DROP TABLE IF EXISTS rpc_calls;
CREATE TABLE rpc_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  method TEXT NOT NULL,
  params JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  scheduled_at TIMESTAMPTZ DEFAULT now(),
  executed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  result JSONB,
  error TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  rate_limit_key TEXT,
  job_id UUID REFERENCES job_runs(id) ON DELETE SET NULL
);

-- Indexes for efficient querying
CREATE INDEX idx_rpc_calls_status ON rpc_calls(status);
CREATE INDEX idx_rpc_calls_scheduled_at ON rpc_calls(scheduled_at);
CREATE INDEX idx_rpc_calls_url ON rpc_calls(url);
CREATE INDEX idx_rpc_calls_rate_limit_key ON rpc_calls(rate_limit_key);
CREATE INDEX idx_rpc_calls_job_id ON rpc_calls(job_id);

GRANT ALL PRIVILEGES ON TABLE rpc_calls TO jobruns; 