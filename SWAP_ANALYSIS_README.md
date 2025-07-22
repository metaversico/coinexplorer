# Solana Transaction Swap Analysis

This implementation adds swap analysis functionality to the transaction detail view, capable of identifying and displaying token swaps across multiple DEXs including Raydium CPMM, Raydium CLMM, Orca Whirlpool, and OpenBook.

## Files Created/Modified

### 1. `src/solana/swap-analysis.ts`
- Core swap analysis library for backend/server-side usage
- Contains all the analysis logic and type definitions

### 2. `www/src/lib/swap-analysis.ts` 
- Frontend version of the swap analysis library
- Identical to the backend version for use in React components

### 3. `www/src/components/TransactionDetail.tsx`
- Modified to include swap analysis and display
- Added new `renderSwaps()` function 
- Integrated swap section before token changes section

## Features

### Swap Detection
The library can detect swaps from the following DEXs:
- **Raydium CPMM** (`CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C`)
- **Raydium CLMM** (`675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8`)  
- **Orca Whirlpool** (`whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc`)
- **OpenBook** (`opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb`)

### Swap Information Extracted
For each swap detected, the following information is captured:
- **DEX Type** (e.g., "Raydium CPMM", "Orca Whirlpool")
- **Token In**: mint address, amount, decimals, UI amount
- **Token Out**: mint address, amount, decimals, UI amount  
- **Program ID** of the DEX
- **Instruction Index** where the swap occurred

### UI Display
The swap section appears before the token changes section and shows:
- Total number of swaps detected
- Each swap displayed with:
  - DEX badge (color-coded)
  - "Sold" amount in red with token symbol
  - "Received" amount in green with token symbol
  - Full token mint addresses
  - Technical details (instruction index, program ID)

### Token Symbol Recognition
Built-in recognition for common tokens:
- **SOL** (`So11111111111111111111111111111111111111112`)
- **USDC** (`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`)
- **JUP** (`JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN`)
- Unknown tokens show truncated mint address (first 8 chars + "...")

## Technical Implementation

### Analysis Approach
1. **Instruction Parsing**: Analyzes both top-level and inner instructions
2. **Transfer Detection**: Identifies `transferChecked` and `transfer` operations
3. **DEX Matching**: Matches program IDs to known DEX protocols
4. **Token Flow Analysis**: Pairs input/output transfers to construct swap information
5. **Deduplication**: Prevents duplicate swap detection across instruction levels

### Integration Points
- **Backend**: Use `src/solana/swap-analysis.ts` for server-side analysis
- **Frontend**: Import from `www/src/lib/swap-analysis.ts` in React components
- **API**: Can be integrated into transaction processing pipeline

## Testing

The implementation has been validated against the provided fixture files:
- `fixtures/solana-rpc-getsignature-multidexswap.json` - Contains Whirlpool and OpenBook swaps
- `fixtures/solana-rpc-getsignature-multidexswap2.json` - Contains multiple Raydium CPMM and CLMM swaps

## Usage Example

```typescript
import { analyzeSolanaTransactionSwaps } from './lib/swap-analysis';

// Analyze a transaction result
const swapAnalysis = analyzeSolanaTransactionSwaps(transactionResult);

console.log(`Found ${swapAnalysis.totalSwaps} swaps`);
swapAnalysis.swaps.forEach(swap => {
  console.log(`${swap.type}: ${swap.tokenIn.uiAmount} → ${swap.tokenOut.uiAmount}`);
});
```

## Future Enhancements

1. **Additional DEX Support**: Jupiter V6, Meteora, Lifinity, etc.
2. **Price Impact Calculation**: Calculate swap rates and price impact
3. **MEV Detection**: Identify arbitrage and sandwich attacks
4. **Liquidity Pool Information**: Extract pool addresses and metadata
5. **Historical Analysis**: Compare swap rates against historical data
6. **Multi-hop Routing**: Track complex routing paths through multiple pools