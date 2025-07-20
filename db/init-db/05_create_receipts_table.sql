-- Connect to jobruns DB
\connect jobruns

DROP TABLE IF EXISTS receipts;
CREATE TABLE receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID NOT NULL,
  action TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  job_id UUID REFERENCES job_runs(id) ON DELETE SET NULL
);

-- Indexes for efficient querying
CREATE INDEX idx_receipts_service_name ON receipts(service_name);
CREATE INDEX idx_receipts_resource_type ON receipts(resource_type);
CREATE INDEX idx_receipts_resource_id ON receipts(resource_id);
CREATE INDEX idx_receipts_action ON receipts(action);
CREATE INDEX idx_receipts_created_at ON receipts(created_at);
CREATE INDEX idx_receipts_job_id ON receipts(job_id);

GRANT ALL PRIVILEGES ON TABLE receipts TO jobruns;