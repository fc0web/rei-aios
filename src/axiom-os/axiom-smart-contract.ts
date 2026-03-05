import type { SeedTheory } from './seed-kernel';
import type { SevenLogicValue } from './seven-logic';

export type ContractVerdict =
  | { status: 'PASS' }
  | { status: 'FAIL'; reason: string; violated: string[] }
  | { status: 'UNCERTAIN'; reason: string };

export interface AxiomContract {
  id: string;
  description: string;
  pre: (axiom: SeedTheory) => boolean;
  post: (axiom: SeedTheory, blockHash: string) => boolean;
  invariant: (axioms: SeedTheory[]) => boolean;
  sevenLogicEval?: (axiom: SeedTheory) => SevenLogicValue;
}

export interface ContractViolation {
  contractId: string;
  axiomId: string;
  phase: 'pre' | 'post' | 'invariant';
  reason: string;
  timestamp: number;
}

export class AxiomSmartContract {
  private contracts: Map<string, AxiomContract> = new Map();
  private violations: ContractViolation[] = [];

  constructor() { this.registerDefaults(); }

  register(contract: AxiomContract): void {
    this.contracts.set(contract.id, contract);
  }

  checkPre(axiom: SeedTheory): ContractVerdict {
    const violated: string[] = [];
    for (const [id, contract] of this.contracts) {
      if (!contract.pre(axiom)) {
        violated.push(id);
        this.recordViolation(id, axiom.id, 'pre', 'pre condition failed');
      }
    }
    if (violated.length > 0) {
      return { status: 'FAIL', reason: `事前条件違反: ${violated.join(', ')}`, violated };
    }
    return { status: 'PASS' };
  }

  checkPost(axiom: SeedTheory, blockHash: string): ContractVerdict {
    const violated: string[] = [];
    for (const [id, contract] of this.contracts) {
      if (!contract.post(axiom, blockHash)) {
        violated.push(id);
        this.recordViolation(id, axiom.id, 'post', 'post condition failed');
      }
    }
    if (violated.length > 0) {
      return { status: 'FAIL', reason: `事後条件違反: ${violated.join(', ')}`, violated };
    }
    return { status: 'PASS' };
  }

  checkInvariant(axioms: SeedTheory[]): ContractVerdict {
    const violated: string[] = [];
    for (const [id, contract] of this.contracts) {
      if (!contract.invariant(axioms)) {
        violated.push(id);
        this.recordViolation(id, 'GLOBAL', 'invariant', 'invariant violated');
      }
    }
    if (violated.length > 0) {
      return { status: 'FAIL', reason: `不変条件違反: ${violated.join(', ')}`, violated };
    }
    return { status: 'PASS' };
  }

  evaluateSevenLogic(axiom: SeedTheory): Map<string, SevenLogicValue> {
    const results = new Map<string, SevenLogicValue>();
    for (const [id, contract] of this.contracts) {
      if (contract.sevenLogicEval) {
        results.set(id, contract.sevenLogicEval(axiom));
      }
    }
    return results;
  }

  getViolations(): ContractViolation[] { return [...this.violations]; }
  getViolationCount(): number { return this.violations.length; }

  private recordViolation(
    contractId: string, axiomId: string,
    phase: 'pre' | 'post' | 'invariant', reason: string
  ): void {
    this.violations.push({ contractId, axiomId, phase, reason, timestamp: Date.now() });
  }

  private registerDefaults(): void {
    // 契約1: 公理文字列が空でない
    this.register({
      id: 'non-empty-axiom',
      description: '公理文字列は空であってはならない',
      pre: (a) => a.axiom.trim().length > 0,
      post: (_a, _h) => true,
      invariant: (axioms) => axioms.every(a => a.axiom.trim().length > 0),
    });

    // 契約2: IDが一意（不変条件）
    this.register({
      id: 'unique-id',
      description: '公理IDはチェーン内で一意でなければならない',
      pre: (_a) => true,
      post: (_a, _h) => true,
      invariant: (axioms) => {
        const ids = axioms.map(a => a.id);
        return new Set(ids).size === ids.length;
      },
    });

    // 契約3: カテゴリが既知のD-FUMTカテゴリ
    const VALID_CATEGORIES = new Set([
      'logic', 'computation', 'mathematics', 'zero_extension',
      'number-system', 'expansion', 'ai-integration', 'unified',
      'consciousness', 'general', 'physics', 'projection',
    ]);
    this.register({
      id: 'valid-category',
      description: 'カテゴリはD-FUMTの既知カテゴリでなければならない',
      pre: (a) => VALID_CATEGORIES.has(a.category),
      post: (_a, _h) => true,
      invariant: (axioms) => axioms.every(a => VALID_CATEGORIES.has(a.category)),
      sevenLogicEval: (a) => VALID_CATEGORIES.has(a.category) ? 'TRUE' : 'FLOWING',
    });

    // 契約4: キーワードが1つ以上ある
    this.register({
      id: 'has-keywords',
      description: '公理には少なくとも1つのキーワードが必要',
      pre: (a) => a.keywords.length > 0,
      post: (_a, _h) => true,
      invariant: (axioms) => axioms.every(a => a.keywords.length > 0),
      sevenLogicEval: (a) =>
        a.keywords.length >= 2 ? 'TRUE' :
        a.keywords.length === 1 ? 'FLOWING' : 'FALSE',
    });
  }
}
