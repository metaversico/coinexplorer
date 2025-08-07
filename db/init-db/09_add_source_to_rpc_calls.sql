\connect jobruns

ALTER TABLE rpc_calls ADD COLUMN IF NOT EXISTS source TEXT;

CREATE INDEX IF NOT EXISTS idx_rpc_calls_source ON rpc_calls(source);
