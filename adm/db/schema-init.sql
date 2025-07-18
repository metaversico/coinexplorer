-- Create user if not exists
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles WHERE rolname = 'jobruns') THEN
      CREATE ROLE jobruns LOGIN PASSWORD 'jobruns';
   END IF;
END
$do$;

-- Create database if not exists
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_database WHERE datname = 'jobruns') THEN
      CREATE DATABASE jobruns OWNER jobruns;
   END IF;
END
$do$;

-- Connect to jobruns database and create table
\c jobruns

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