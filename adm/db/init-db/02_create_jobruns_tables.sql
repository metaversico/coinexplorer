-- Connect to jobruns DB
\connect jobruns

DROP TABLE IF EXISTS job_runs;
CREATE TABLE job_runs (
  id UUID PRIMARY KEY,
  jobname TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ,
  result JSONB,
  error TEXT
);

GRANT ALL PRIVILEGES ON DATABASE jobruns TO jobruns;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO jobruns;