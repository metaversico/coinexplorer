\connect coins

DROP TABLE IF EXISTS coins;
CREATE TABLE IF NOT EXISTS coins (
  address TEXT PRIMARY KEY,
  name TEXT,
  symbol TEXT,
  chain TEXT,
  metadata JSONB
); 

GRANT ALL PRIVILEGES ON DATABASE coins TO coins;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO coins;