CREATE TABLE IF NOT EXISTS coins (
  address TEXT PRIMARY KEY,
  name TEXT,
  symbol TEXT,
  chain TEXT,
  metadata JSONB
); 