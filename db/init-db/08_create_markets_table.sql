\connect coins

CREATE TABLE IF NOT EXISTS markets (
    address TEXT PRIMARY KEY,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_markets_updated_at ON markets;
CREATE TRIGGER set_markets_updated_at
BEFORE UPDATE ON markets
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

GRANT ALL PRIVILEGES ON DATABASE markets TO coins;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO coins;