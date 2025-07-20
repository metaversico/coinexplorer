-- Connect to jobruns DB
\connect jobruns

DROP TABLE IF EXISTS signatures;
CREATE TABLE signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signature TEXT NOT NULL,
  slot BIGINT,
  err TEXT,
  memo TEXT,
  block_time BIGINT,
  confirmation_status TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  rpc_call_id UUID REFERENCES rpc_calls(id) ON DELETE SET NULL
);

-- Indexes for efficient querying
CREATE UNIQUE INDEX idx_signatures_signature_unique ON signatures(signature);
CREATE INDEX idx_signatures_block_time ON signatures(block_time);
CREATE INDEX idx_signatures_rpc_call_id ON signatures(rpc_call_id);

-- Add comment to document that signatures are independent of markets
COMMENT ON TABLE signatures IS 'Signatures are stored independently of markets. Market associations are handled separately.';

GRANT ALL PRIVILEGES ON TABLE signatures TO jobruns; 