-- Connect to jobruns DB
\connect jobruns

DROP TABLE IF EXISTS receipts;
CREATE TABLE receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_uri TEXT NOT NULL,
  target_uri TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX idx_receipts_origin_uri ON receipts(origin_uri);
CREATE INDEX idx_receipts_target_uri ON receipts(target_uri);
CREATE INDEX idx_receipts_created_at ON receipts(created_at);

GRANT ALL PRIVILEGES ON TABLE receipts TO jobruns;