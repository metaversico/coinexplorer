# API Filtering Implementation

## Summary

This document describes the implementation of server-side filtering and sorting for the `/api/transactions` endpoint.

## Changes Made

### 1. Backend API Changes (`api/main.ts`)

#### Updated `getTransactions` Function
- **Before**: `getTransactions(limit, offset)`
- **After**: `getTransactions(limit, offset, method?, sort)`

#### New Parameters
- `method?: string` - Filter by RPC method name (e.g., 'getSignaturesForAddress', 'getTransaction')
- `sort: string` - Sort order ('asc' for earliest first, 'desc' for latest first)

#### Dynamic SQL Query Building
```sql
-- Base query
SELECT rcr.id, rcr.rpc_call_id, rc.method, rc.params, rcr.result, rcr.error, rcr.created_at, rcr.completed_at
FROM rpc_call_results rcr
JOIN rpc_calls rc ON rcr.rpc_call_id = rc.id
WHERE rcr.result IS NOT NULL

-- With method filter (when provided)
AND rc.method = $1

-- With dynamic sorting
ORDER BY rcr.created_at [ASC|DESC]

-- With pagination
LIMIT $n OFFSET $n+1
```

#### Request Handler Updates
- Parses query parameters: `limit`, `offset`, `method`, `sort`
- Validates parameters for security:
  - `limit`: Clamped between 1-100
  - `offset`: Must be non-negative
  - `method`: Must be in allowed list ('getSignaturesForAddress', 'getTransaction')
  - `sort`: Must be 'asc' or 'desc'
- Returns 400 error for invalid parameters
- Logs requests for debugging

### 2. Database Index Optimization

#### New Database Index (`db/init-db/07_add_method_index.sql`)
```sql
CREATE INDEX IF NOT EXISTS idx_rpc_calls_method ON rpc_calls(method);
```

This index improves query performance when filtering by method.

### 3. Frontend API Client Updates (`www/src/lib/api.ts`)

#### New Interface
```typescript
export interface TransactionFilters {
  method?: string | null;
  sortOrder?: SortOrder;
}
```

#### Updated `fetchTransactions` Function
- **Before**: `fetchTransactions(limit, offset)`
- **After**: `fetchTransactions(limit, offset, filters?)`
- Constructs URL parameters: `method`, `sort`

### 4. Architecture Overview

#### API-Based Filtering (Main Transaction List)
- **Data Source**: PostgreSQL database via API
- **Filtering**: Server-side SQL WHERE clauses
- **Sorting**: Server-side SQL ORDER BY
- **Pagination**: Server-side LIMIT/OFFSET
- **Performance**: Efficient for large datasets
- **Network**: New API call per filter change

#### Local In-Memory Filtering (Comparison Pane)  
- **Data Source**: Selected transactions in memory
- **Filtering**: Client-side JavaScript array filtering
- **Sorting**: Client-side JavaScript array sorting
- **Pagination**: Not needed (small dataset)
- **Performance**: Instant filtering
- **Network**: No additional API calls

## API Usage Examples

### Get All Transactions (Default)
```
GET /api/transactions?limit=20&offset=0
```

### Filter by Method
```
GET /api/transactions?limit=20&offset=0&method=getSignaturesForAddress
```

### Sort Earliest First
```
GET /api/transactions?limit=20&offset=0&sort=asc
```

### Combined Filter and Sort
```
GET /api/transactions?limit=20&offset=0&method=getTransaction&sort=asc
```

### Error Responses
```json
{
  "error": "Invalid method filter. Allowed methods: getSignaturesForAddress, getTransaction"
}
```

## Security Features

1. **Method Validation**: Only allowed RPC methods can be filtered
2. **Parameter Sanitization**: All parameters are validated and sanitized
3. **SQL Injection Prevention**: Uses parameterized queries
4. **Rate Limiting**: Limit parameter clamped to prevent large queries

## Performance Considerations

1. **Database Indexes**: Added index on `rpc_calls.method` for efficient filtering
2. **Query Optimization**: Dynamic query building minimizes unnecessary JOINs
3. **Pagination**: Server-side pagination prevents large result sets
4. **Caching**: Consider adding Redis caching for frequently accessed filters

## Testing

The API changes have been:
- ✅ Type-checked with Deno
- ✅ Logic-tested with mock data
- ✅ SQL query validation completed
- ✅ Frontend integration confirmed

## Migration Notes

1. **Database**: Run the new index creation script (`07_add_method_index.sql`)
2. **API**: No breaking changes - all parameters are optional
3. **Frontend**: Updated to use new filtering parameters
4. **Backward Compatibility**: Maintained - old API calls still work

## Future Enhancements

1. **Additional Filters**: Can easily add filters for date ranges, error status, etc.
2. **Full-Text Search**: Add search across params/results using PostgreSQL full-text search
3. **Caching**: Add Redis caching for popular filter combinations
4. **Analytics**: Track popular filter combinations for optimization