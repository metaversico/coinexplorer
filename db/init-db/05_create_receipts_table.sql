-- Connect to jobruns DB
\connect jobruns

DROP TABLE IF EXISTS receipts;
CREATE TABLE receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_uri TEXT NOT NULL,
  target_uri TEXT NOT NULL,
  action TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  job_id UUID REFERENCES job_runs(id) ON DELETE SET NULL
);

-- Indexes for efficient querying
CREATE INDEX idx_receipts_origin_uri ON receipts(origin_uri);
CREATE INDEX idx_receipts_target_uri ON receipts(target_uri);
CREATE INDEX idx_receipts_action ON receipts(action);
CREATE INDEX idx_receipts_created_at ON receipts(created_at);
CREATE INDEX idx_receipts_job_id ON receipts(job_id);

GRANT ALL PRIVILEGES ON TABLE receipts TO jobruns;