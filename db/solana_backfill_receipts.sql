-- Connect to jobruns DB
\connect jobruns

-- Function to get backfill state for a given market
-- Returns JSON with: { "state": "first_run|pending|ready", "last_signature": "<sig>|null" }
CREATE OR REPLACE FUNCTION get_market_backfill_state(market_name TEXT)
RETURNS JSONB AS $$
DECLARE
    receipt_target_uri TEXT;
    rpc_call_result JSONB;
    result_array_length INTEGER;
    last_signature TEXT := NULL;
    has_pending_call BOOLEAN := FALSE;
BEGIN
    -- Find the most recent receipt for this market's backfill job
    SELECT r.target_uri INTO receipt_target_uri
    FROM receipts r
    WHERE r.origin_uri = 'solana-signature-backfill/' || market_name
      AND r.target_uri LIKE 'rpc_call/%'
    ORDER BY r.created_at DESC
    LIMIT 1;
    
    -- If no receipt found, this is the first backfill run
    IF receipt_target_uri IS NULL THEN
        RETURN jsonb_build_object('state', 'first_run', 'last_signature', NULL);
    END IF;
    
    -- Check if there's a completed result for the most recent RPC call
    SELECT rcr.result INTO rpc_call_result
    FROM rpc_call_results rcr
    JOIN rpc_calls rc ON rcr.rpc_call_id = rc.id
    WHERE rcr.rpc_call_id::text = SUBSTRING(receipt_target_uri FROM 'rpc_call/(.*)$')
      AND rcr.result IS NOT NULL
    ORDER BY rcr.completed_at DESC
    LIMIT 1;
    
    -- If no result found, the RPC call is still pending
    IF rpc_call_result IS NULL THEN
        RETURN jsonb_build_object('state', 'pending', 'last_signature', NULL);
    END IF;
    
    -- Get the length of the result array
    result_array_length := jsonb_array_length(rpc_call_result);
    
    -- If array is empty, we're ready but no signature to continue from
    IF result_array_length IS NULL OR result_array_length = 0 THEN
        RETURN jsonb_build_object('state', 'ready', 'last_signature', NULL);
    END IF;
    
    -- Extract the last signature from the result array
    last_signature := rpc_call_result -> (result_array_length - 1) ->> 'signature';
    
    RETURN jsonb_build_object('state', 'ready', 'last_signature', last_signature);
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to jobruns user
GRANT EXECUTE ON FUNCTION get_market_backfill_state(TEXT) TO jobruns;