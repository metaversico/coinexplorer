export interface SwapInfo {
  type: 'raydium_cpmm' | 'raydium_clmm' | 'orca_whirlpool' | 'openbook' | 'unknown';
  tokenIn: {
    mint: string;
    amount: string;
    uiAmount: number;
    decimals: number;
  };
  tokenOut: {
    mint: string;
    amount: string;
    uiAmount: number;
    decimals: number;
  };
  programId: string;
  poolAddress?: string;
  instructionIndex: number;
}

export interface SwapAnalysisResult {
  swaps: SwapInfo[];
  totalSwaps: number;
}

// Known program IDs for different DEXs
const PROGRAM_IDS = {
  WHIRLPOOL: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
  RAYDIUM_CPMM: 'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C',
  RAYDIUM_CLMM: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  OPENBOOK: 'opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb',
  JUPITER: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
};

// Known token mints
const KNOWN_TOKENS = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
};

function getTokenFromTransferInstruction(instruction: any, transaction: any): {
  mint: string;
  amount: string;
  decimals: number;
  uiAmount: number;
  source: string;
  destination: string;
} | null {
  if (instruction.parsed?.type === 'transferChecked') {
    const info = instruction.parsed.info;
    return {
      mint: info.mint,
      amount: info.tokenAmount.amount,
      decimals: info.tokenAmount.decimals,
      uiAmount: info.tokenAmount.uiAmount || 0,
      source: info.source,
      destination: info.destination,
    };
  }
  
  if (instruction.parsed?.type === 'transfer') {
    // For regular transfers, we need to infer the mint from token balances
    const info = instruction.parsed.info;
    const tokenBalances = transaction.meta?.preTokenBalances || [];
    
    // Find the mint by matching the source account
    for (const balance of tokenBalances) {
      const accountKeys = transaction.transaction?.message?.accountKeys || [];
      const accountAddress = accountKeys[balance.accountIndex]?.pubkey;
      if (accountAddress === info.source) {
        return {
          mint: balance.mint,
          amount: info.amount,
          decimals: balance.uiTokenAmount.decimals,
          uiAmount: parseFloat(info.amount) / Math.pow(10, balance.uiTokenAmount.decimals),
          source: info.source,
          destination: info.destination,
        };
      }
    }
  }
  
  return null;
}

function analyzeRaydiumCpmmSwap(instruction: any, instructionIndex: number, innerInstructionIndex: number, allInnerInstructions: any[], transaction: any): SwapInfo | null {
  if (instruction.programId !== PROGRAM_IDS.RAYDIUM_CPMM) {
    return null;
  }

  // Look for transfer instructions that come immediately after this CPMM instruction
  const transfers: any[] = [];
  
  // Check the next few instructions after the current CPMM instruction for transfers
  for (let i = innerInstructionIndex + 1; i < allInnerInstructions.length && i < innerInstructionIndex + 4; i++) {
    const nextInst = allInnerInstructions[i];
    
    // Stop if we hit another DEX instruction (indicates start of next swap)
    if (nextInst.programId === PROGRAM_IDS.RAYDIUM_CPMM ||
        nextInst.programId === PROGRAM_IDS.RAYDIUM_CLMM ||
        nextInst.programId === PROGRAM_IDS.WHIRLPOOL ||
        nextInst.programId === PROGRAM_IDS.OPENBOOK) {
      break;
    }
    
    const tokenTransfer = getTokenFromTransferInstruction(nextInst, transaction);
    if (tokenTransfer) {
      transfers.push(tokenTransfer);
    }
  }

  if (transfers.length >= 2) {
    // First transfer is typically the input (user sending tokens to pool)
    // Second transfer is typically the output (pool sending tokens to user)
    const tokenIn = transfers[0];
    const tokenOut = transfers[1];
    
    return {
      type: 'raydium_cpmm',
      programId: PROGRAM_IDS.RAYDIUM_CPMM,
      instructionIndex,
      tokenIn: {
        mint: tokenIn.mint,
        amount: tokenIn.amount,
        uiAmount: tokenIn.uiAmount,
        decimals: tokenIn.decimals,
      },
      tokenOut: {
        mint: tokenOut.mint,
        amount: tokenOut.amount,
        uiAmount: tokenOut.uiAmount,
        decimals: tokenOut.decimals,
      },
    };
  }

  return null;
}

function analyzeRaydiumClmmSwap(instruction: any, instructionIndex: number, innerInstructionIndex: number, allInnerInstructions: any[], transaction: any): SwapInfo | null {
  if (instruction.programId !== PROGRAM_IDS.RAYDIUM_CLMM) {
    return null;
  }

  // Look for transfer instructions that come immediately after this CLMM instruction
  const transfers: any[] = [];
  
  // Check the next few instructions after the current CLMM instruction for transfers
  for (let i = innerInstructionIndex + 1; i < allInnerInstructions.length && i < innerInstructionIndex + 4; i++) {
    const nextInst = allInnerInstructions[i];
    
    // Stop if we hit another DEX instruction (indicates start of next swap)
    if (nextInst.programId === PROGRAM_IDS.RAYDIUM_CPMM ||
        nextInst.programId === PROGRAM_IDS.RAYDIUM_CLMM ||
        nextInst.programId === PROGRAM_IDS.WHIRLPOOL ||
        nextInst.programId === PROGRAM_IDS.OPENBOOK) {
      break;
    }
    
    const tokenTransfer = getTokenFromTransferInstruction(nextInst, transaction);
    if (tokenTransfer) {
      transfers.push(tokenTransfer);
    }
  }

  if (transfers.length >= 2) {
    const tokenIn = transfers[0];
    const tokenOut = transfers[1];
    
    return {
      type: 'raydium_clmm',
      programId: PROGRAM_IDS.RAYDIUM_CLMM,
      instructionIndex,
      tokenIn: {
        mint: tokenIn.mint,
        amount: tokenIn.amount,
        uiAmount: tokenIn.uiAmount,
        decimals: tokenIn.decimals,
      },
      tokenOut: {
        mint: tokenOut.mint,
        amount: tokenOut.amount,
        uiAmount: tokenOut.uiAmount,
        decimals: tokenOut.decimals,
      },
    };
  }

  return null;
}

function analyzeWhirlpoolSwap(instruction: any, instructionIndex: number, innerInstructionIndex: number, allInnerInstructions: any[], transaction: any): SwapInfo | null {
  if (instruction.programId !== PROGRAM_IDS.WHIRLPOOL) {
    return null;
  }

  // Look for transfer instructions that come immediately after this Whirlpool instruction
  const transfers: any[] = [];
  
  // Check the next few instructions after the current Whirlpool instruction for transfers
  for (let i = innerInstructionIndex + 1; i < allInnerInstructions.length && i < innerInstructionIndex + 4; i++) {
    const nextInst = allInnerInstructions[i];
    
    // Stop if we hit another DEX instruction (indicates start of next swap)
    if (nextInst.programId === PROGRAM_IDS.RAYDIUM_CPMM ||
        nextInst.programId === PROGRAM_IDS.RAYDIUM_CLMM ||
        nextInst.programId === PROGRAM_IDS.WHIRLPOOL ||
        nextInst.programId === PROGRAM_IDS.OPENBOOK) {
      break;
    }
    
    const tokenTransfer = getTokenFromTransferInstruction(nextInst, transaction);
    if (tokenTransfer) {
      transfers.push(tokenTransfer);
    }
  }

  if (transfers.length >= 2) {
    const tokenIn = transfers[0];
    const tokenOut = transfers[1];
    
    return {
      type: 'orca_whirlpool',
      programId: PROGRAM_IDS.WHIRLPOOL,
      instructionIndex,
      tokenIn: {
        mint: tokenIn.mint,
        amount: tokenIn.amount,
        uiAmount: tokenIn.uiAmount,
        decimals: tokenIn.decimals,
      },
      tokenOut: {
        mint: tokenOut.mint,
        amount: tokenOut.amount,
        uiAmount: tokenOut.uiAmount,
        decimals: tokenOut.decimals,
      },
    };
  }

  return null;
}

function analyzeOpenbookSwap(instruction: any, instructionIndex: number, innerInstructionIndex: number, allInnerInstructions: any[], transaction: any): SwapInfo | null {
  if (instruction.programId !== PROGRAM_IDS.OPENBOOK) {
    return null;
  }

  // Look for transfer instructions that come immediately after this OpenBook instruction
  const transfers: any[] = [];
  
  // Check the next few instructions after the current OpenBook instruction for transfers
  for (let i = innerInstructionIndex + 1; i < allInnerInstructions.length && i < innerInstructionIndex + 4; i++) {
    const nextInst = allInnerInstructions[i];
    
    // Stop if we hit another DEX instruction (indicates start of next swap)
    if (nextInst.programId === PROGRAM_IDS.RAYDIUM_CPMM ||
        nextInst.programId === PROGRAM_IDS.RAYDIUM_CLMM ||
        nextInst.programId === PROGRAM_IDS.WHIRLPOOL ||
        nextInst.programId === PROGRAM_IDS.OPENBOOK) {
      break;
    }
    
    const tokenTransfer = getTokenFromTransferInstruction(nextInst, transaction);
    if (tokenTransfer) {
      transfers.push(tokenTransfer);
    }
  }

  if (transfers.length >= 2) {
    const tokenIn = transfers[0];
    const tokenOut = transfers[1];
    
    return {
      type: 'openbook',
      programId: PROGRAM_IDS.OPENBOOK,
      instructionIndex,
      tokenIn: {
        mint: tokenIn.mint,
        amount: tokenIn.amount,
        uiAmount: tokenIn.uiAmount,
        decimals: tokenIn.decimals,
      },
      tokenOut: {
        mint: tokenOut.mint,
        amount: tokenOut.amount,
        uiAmount: tokenOut.uiAmount,
        decimals: tokenOut.decimals,
      },
    };
  }

  return null;
}

export function analyzeSolanaTransactionSwaps(transactionResult: any): SwapAnalysisResult {
  if (!transactionResult?.transaction?.message?.instructions) {
    return { swaps: [], totalSwaps: 0 };
  }

  const swaps: SwapInfo[] = [];

  // Analyze inner instructions where the actual DEX calls happen
  const innerInstructions = transactionResult.meta?.innerInstructions || [];
  for (const innerGroup of innerInstructions) {
    const allInnerInstructions = innerGroup.instructions;
    
    // Look for DEX program calls in the inner instructions
    for (let j = 0; j < allInnerInstructions.length; j++) {
      const instruction = allInnerInstructions[j];
      
      // Skip Jupiter routing instructions - we want to analyze the actual DEX swaps
      if (instruction.programId === PROGRAM_IDS.JUPITER) {
        continue;
      }

      let swap: SwapInfo | null = null;

      // Try to analyze as different swap types
      swap = analyzeRaydiumCpmmSwap(instruction, innerGroup.index, j, allInnerInstructions, transactionResult) ||
             analyzeRaydiumClmmSwap(instruction, innerGroup.index, j, allInnerInstructions, transactionResult) ||
             analyzeWhirlpoolSwap(instruction, innerGroup.index, j, allInnerInstructions, transactionResult) ||
             analyzeOpenbookSwap(instruction, innerGroup.index, j, allInnerInstructions, transactionResult);

      if (swap) {
        // Add a unique identifier to avoid duplicates
        const swapId = `${swap.programId}-${swap.instructionIndex}-${j}-${swap.tokenIn.mint}-${swap.tokenOut.mint}`;
        const existingSwap = swaps.find(s => 
          `${s.programId}-${s.instructionIndex}-${s.tokenIn.mint}-${s.tokenOut.mint}`.includes(swapId.substring(0, 50))
        );
        
        if (!existingSwap) {
          swaps.push(swap);
        }
      }
    }
  }

  // Also check top-level instructions for any direct DEX calls
  const instructions = transactionResult.transaction.message.instructions;
  for (let i = 0; i < instructions.length; i++) {
    const instruction = instructions[i];
    
    // Skip Jupiter routing instructions - we want to analyze the actual DEX swaps
    if (instruction.programId === PROGRAM_IDS.JUPITER) {
      continue;
    }

    // For top-level DEX calls, we need to find their associated inner instructions
    const relevantInnerGroup = innerInstructions.find(inner => inner.index === i);
    if (relevantInnerGroup) {
      // This case is already handled above in the inner instructions loop
      continue;
    }

    // Handle direct DEX calls without inner instructions (rare case)
    let swap: SwapInfo | null = null;
    const emptyInnerInstructions: any[] = [];
    
    swap = analyzeRaydiumCpmmSwap(instruction, i, 0, emptyInnerInstructions, transactionResult) ||
           analyzeRaydiumClmmSwap(instruction, i, 0, emptyInnerInstructions, transactionResult) ||
           analyzeWhirlpoolSwap(instruction, i, 0, emptyInnerInstructions, transactionResult) ||
           analyzeOpenbookSwap(instruction, i, 0, emptyInnerInstructions, transactionResult);

    if (swap) {
      swaps.push(swap);
    }
  }

  return {
    swaps,
    totalSwaps: swaps.length,
  };
}

export function getTokenSymbol(mint: string): string {
  switch (mint) {
    case KNOWN_TOKENS.SOL:
      return 'SOL';
    case KNOWN_TOKENS.USDC:
      return 'USDC';
    case KNOWN_TOKENS.JUP:
      return 'JUP';
    default:
      return mint.slice(0, 8) + '...';
  }
}

export function formatSwapType(type: SwapInfo['type']): string {
  switch (type) {
    case 'raydium_cpmm':
      return 'Raydium CPMM';
    case 'raydium_clmm':
      return 'Raydium CLMM';
    case 'orca_whirlpool':
      return 'Orca Whirlpool';
    case 'openbook':
      return 'OpenBook';
    default:
      return 'Unknown DEX';
  }
}