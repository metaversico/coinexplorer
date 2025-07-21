-- Connect to jobruns DB
\connect jobruns

-- Add index on method column for efficient filtering
CREATE INDEX IF NOT EXISTS idx_rpc_calls_method ON rpc_calls(method);

-- This index will improve performance when filtering by method
-- Example query: WHERE rc.method = 'getSignaturesForAddress'