import type { SeedTheory } from './seed-kernel';
import type { AxiomBlock } from './axiom-hash-chain';

export interface ReiTokenBalance {
  nodeId: string;
  balance: number;
  totalEarned: number;
  totalSpent: number;
  contributions: number;
  lastActivity: number;
}

export interface TokenTransaction {
  txId: string;
  from: string;    // 'MINT' = 新規発行
  to: string;      // 'BURN' = ペナルティ消却
  amount: number;
  reason: TokenReason;
  axiomId?: string;
  timestamp: number;
}

export type TokenReason =
  | 'MINT_AXIOM_CONTRIBUTION'
  | 'MINT_VALIDATION_REWARD'
  | 'MINT_COMMON_AXIOM_BONUS'
  | 'BURN_CONTRACT_VIOLATION'
  | 'TRANSFER';

export const TOKEN_PARAMS = {
  BASE_CONTRIBUTION: 10,
  VALIDATION_REWARD: 2,
  COMMON_AXIOM_BONUS: 50,
  HIGH_CONFIDENCE_MULTIPLIER: 2,
  VIOLATION_PENALTY: 20,
  TOTAL_SUPPLY_CAP: 21_000_000,  // ビットコイン的な上限（参考値）
} as const;

export class AxiomTokenEconomy {
  private balances = new Map<string, ReiTokenBalance>();
  private transactions: TokenTransaction[] = [];
  private totalMinted = 0;

  register(nodeId: string): ReiTokenBalance {
    if (this.balances.has(nodeId)) return this.balances.get(nodeId)!;
    const balance: ReiTokenBalance = {
      nodeId, balance: 0, totalEarned: 0,
      totalSpent: 0, contributions: 0, lastActivity: Date.now(),
    };
    this.balances.set(nodeId, balance);
    return balance;
  }

  rewardContribution(nodeId: string, axiom: SeedTheory, block: AxiomBlock): TokenTransaction {
    const account = this.getOrRegister(nodeId);
    const highConfidence = axiom.keywords.length >= 3;
    const amount = highConfidence
      ? TOKEN_PARAMS.BASE_CONTRIBUTION * TOKEN_PARAMS.HIGH_CONFIDENCE_MULTIPLIER
      : TOKEN_PARAMS.BASE_CONTRIBUTION;
    account.balance += amount;
    account.totalEarned += amount;
    account.contributions++;
    account.lastActivity = Date.now();
    this.totalMinted += amount;
    return this.recordTx('MINT', nodeId, amount, 'MINT_AXIOM_CONTRIBUTION', axiom.id);
  }

  rewardValidation(nodeId: string): TokenTransaction {
    const account = this.getOrRegister(nodeId);
    const amount = TOKEN_PARAMS.VALIDATION_REWARD;
    account.balance += amount;
    account.totalEarned += amount;
    account.lastActivity = Date.now();
    this.totalMinted += amount;
    return this.recordTx('MINT', nodeId, amount, 'MINT_VALIDATION_REWARD');
  }

  rewardCommonAxiom(nodeId: string, axiomId: string): TokenTransaction {
    const account = this.getOrRegister(nodeId);
    const amount = TOKEN_PARAMS.COMMON_AXIOM_BONUS;
    account.balance += amount;
    account.totalEarned += amount;
    account.lastActivity = Date.now();
    this.totalMinted += amount;
    return this.recordTx('MINT', nodeId, amount, 'MINT_COMMON_AXIOM_BONUS', axiomId);
  }

  penalize(nodeId: string, axiomId?: string): TokenTransaction {
    const account = this.getOrRegister(nodeId);
    const amount = Math.min(TOKEN_PARAMS.VIOLATION_PENALTY, account.balance);
    account.balance -= amount;
    account.totalSpent += amount;
    account.lastActivity = Date.now();
    return this.recordTx(nodeId, 'BURN', amount, 'BURN_CONTRACT_VIOLATION', axiomId);
  }

  getBalance(nodeId: string): number {
    return this.balances.get(nodeId)?.balance ?? 0;
  }

  getAccount(nodeId: string): ReiTokenBalance | undefined {
    return this.balances.get(nodeId);
  }

  getTransactions(): TokenTransaction[] { return [...this.transactions]; }
  getTotalMinted(): number { return this.totalMinted; }

  getLeaderboard(topN: number = 10): ReiTokenBalance[] {
    return [...this.balances.values()]
      .sort((a, b) => b.totalEarned - a.totalEarned)
      .slice(0, topN);
  }

  private getOrRegister(nodeId: string): ReiTokenBalance {
    if (!this.balances.has(nodeId)) this.register(nodeId);
    return this.balances.get(nodeId)!;
  }

  private recordTx(
    from: string, to: string, amount: number,
    reason: TokenReason, axiomId?: string
  ): TokenTransaction {
    const tx: TokenTransaction = {
      txId: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      from, to, amount, reason, axiomId, timestamp: Date.now(),
    };
    this.transactions.push(tx);
    return tx;
  }
}
