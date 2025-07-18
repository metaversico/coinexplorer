-- Connect to jobruns DB
\connect jobruns

-- Create table if not exists
CREATE TABLE IF NOT EXISTS job_runs (
  id SERIAL PRIMARY KEY,
  jobname TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ,
  result JSONB
);

GRANT ALL PRIVILEGES ON DATABASE jobruns TO jobruns;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO jobruns;