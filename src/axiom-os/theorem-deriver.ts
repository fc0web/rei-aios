/**
 * TheoremDeriver — 定理演繹エンジン
 *
 * D-FUMT Theory #78: 演繹定理生成理論
 * 「公理 A ∧ B → C という形式で、
 *  SEED_KERNELから新しい命題（定理）を導く」
 *
 * 演繹規則（七価論理上）:
 *   Modus Ponens : A=TRUE, A→B=TRUE → B=TRUE
 *   Conjunction  : A=TRUE, B=TRUE   → A∧B=TRUE
 *   Disjunction  : A=TRUE           → A∨B=TRUE
 *   七価拡張     : A=FLOWING, B=FLOWING → A∧B=FLOWING（流動伝播）
 *   矛盾除去     : A=BOTH → 演繹停止（ContradictionDetector連携）
 *
 * AriadneTracer との関係:
 *   TheoremDeriver → 公理から定理へ（前進）
 *   AriadneTracer  → 定理から公理へ（逆引き）
 *   両者は互いに補完する
 */

import { type SeedTheory, SEED_KERNEL } from './seed-kernel';
import { type SevenLogicValue, and, or, toSymbol } from './seven-logic';

// ── 演繹規則の種別 ──
export type DeductionRule =
  | 'modus_ponens'   // A, A→B ⊢ B
  | 'conjunction'    // A, B ⊢ A∧B
  | 'disjunction'    // A ⊢ A∨B
  | 'seven_flow'     // 七価論理の流動伝播
  | 'omega_collapse'; // Ω収束（BOTH→解決）

// ── 定理 ──
export interface Theorem {
  id: string;                    // theorem-NNNN
  statement: string;             // 定理の命題テキスト
  derivedFrom: string[];         // 使用した公理ID群
  rule: DeductionRule;           // 使用した演繹規則
  logicValue: SevenLogicValue;   // 定理の真理値
  confidence: number;            // 確信度 (0〜1)
  depth: number;                 // 演繹の深さ（公理=0, 1次定理=1, ...）
  createdAt: number;
  proof: string;                 // 証明の概略
}

// ── 演繹結果 ──
export interface DerivationResult {
  success: boolean;
  theorem?: Theorem;
  stoppedReason?: string;        // 演繹が停止した理由
  steps: string[];               // 演繹の各ステップ
}

// ── 定理体系 ──
export interface TheoremSystem {
  baseAxioms: string[];          // 出発公理ID群
  theorems: Theorem[];           // 導かれた定理群
  maxDepth: number;              // 到達した最大深さ
  totalDerived: number;
}

export class TheoremDeriver {
  private theorems: Map<string, Theorem> = new Map();
  private counter = 0;

  // ══════════════════════════════════════════════════════════════
  // 単一演繹
  // ══════════════════════════════════════════════════════════════

  /**
   * 2つの公理からModus Ponensで定理を導く
   *
   * A（前提）と A→B（含意）から B（結論）を導く
   */
  modusPonens(
    premiseId: string,
    implicationId: string,
  ): DerivationResult {
    const premise   = this.findTheory(premiseId);
    const implication = this.findTheory(implicationId);

    if (!premise || !implication) {
      return { success: false, stoppedReason: '公理が見つかりません', steps: [] };
    }

    // BOTH状態の公理からは演繹しない（矛盾の伝播防止）
    if (premise.category === 'BOTH' as any) {
      return { success: false, stoppedReason: 'BOTH状態の公理から演繹不可', steps: [] };
    }

    const resultValue: SevenLogicValue = and(
      this.axiomToLogic(premise),
      this.axiomToLogic(implication),
    );

    const theorem = this.createTheorem(
      `${premise.axiom} ∧ ${implication.axiom} → 新命題`,
      [premiseId, implicationId],
      'modus_ponens',
      resultValue,
      1,
      `Modus Ponens: [${premiseId}] × [${implicationId}] → ${toSymbol(resultValue)}`,
    );

    return {
      success: true,
      theorem,
      steps: [
        `前提: ${premise.axiom} (${toSymbol(this.axiomToLogic(premise))})`,
        `含意: ${implication.axiom} (${toSymbol(this.axiomToLogic(implication))})`,
        `結論: ${theorem.statement} (${toSymbol(resultValue)})`,
      ],
    };
  }

  /**
   * カテゴリが同じ公理群を結合して新定理を導く（Conjunction）
   */
  conjoin(axiomIds: string[]): DerivationResult {
    const theories = axiomIds
      .map(id => this.findTheory(id))
      .filter(Boolean) as SeedTheory[];

    if (theories.length < 2) {
      return { success: false, stoppedReason: '結合には2つ以上の公理が必要', steps: [] };
    }

    // 七価論理の and で全て結合
    const combined = theories.reduce<SevenLogicValue>(
      (acc, t) => and(acc, this.axiomToLogic(t)),
      'TRUE',
    );

    // BOTH が出たら停止（ContradictionDetector に委ねる）
    if (combined === 'BOTH') {
      return {
        success: false,
        stoppedReason: `BOTH 検出: [${axiomIds.join(', ')}] の結合に矛盾あり`,
        steps: theories.map(t => `  ${t.id}: ${toSymbol(this.axiomToLogic(t))}`),
      };
    }

    const statement = `${theories.map(t => t.axiom).join(' ∧ ')}`;
    const theorem = this.createTheorem(
      statement,
      axiomIds,
      'conjunction',
      combined,
      1,
      `Conjunction: ${axiomIds.join(' ∧ ')} → ${toSymbol(combined)}`,
    );

    return {
      success: true,
      theorem,
      steps: [
        ...theories.map(t => `前提: ${t.axiom} (${toSymbol(this.axiomToLogic(t))})`),
        `結論: ${toSymbol(combined)}`,
      ],
    };
  }

  /**
   * 同カテゴリの公理群から定理体系を構築する
   */
  deriveSystem(category: string, maxDepth = 2): TheoremSystem {
    const baseAxioms = SEED_KERNEL.filter(t => t.category === category);
    const baseIds = baseAxioms.map(t => t.id);
    const allTheorems: Theorem[] = [];

    // 深さ1: 全ペアの結合
    for (let i = 0; i < baseAxioms.length; i++) {
      for (let j = i + 1; j < baseAxioms.length; j++) {
        const result = this.conjoin([baseAxioms[i].id, baseAxioms[j].id]);
        if (result.success && result.theorem) {
          allTheorems.push(result.theorem);
        }
      }
    }

    // 深さ2: 定理同士の結合
    if (maxDepth >= 2 && allTheorems.length > 1) {
      const t0 = allTheorems[0];
      const t1 = allTheorems[1];
      if (t0 && t1) {
        const combined = and(t0.logicValue, t1.logicValue);
        if (combined !== 'BOTH') {
          const depth2 = this.createTheorem(
            `[${t0.statement}] ∧ [${t1.statement}]`,
            [...t0.derivedFrom, ...t1.derivedFrom],
            'conjunction',
            combined,
            2,
            `深さ2演繹: ${t0.id} × ${t1.id}`,
          );
          allTheorems.push(depth2);
        }
      }
    }

    return {
      baseAxioms: baseIds,
      theorems: allTheorems,
      maxDepth,
      totalDerived: allTheorems.length,
    };
  }

  getTheorems(): Theorem[] { return [...this.theorems.values()]; }

  // ── ヘルパー ──

  private createTheorem(
    statement: string,
    derivedFrom: string[],
    rule: DeductionRule,
    logicValue: SevenLogicValue,
    depth: number,
    proof: string,
  ): Theorem {
    const id = `theorem-${++this.counter}`;
    const confidence = logicValue === 'TRUE' ? 1.0 :
                       logicValue === 'FLOWING' ? 0.6 :
                       logicValue === 'NEITHER' ? 0.3 : 0.5;
    const theorem: Theorem = {
      id, statement, derivedFrom, rule,
      logicValue, confidence, depth,
      createdAt: Date.now(), proof,
    };
    this.theorems.set(id, theorem);
    return theorem;
  }

  private findTheory(id: string): SeedTheory | undefined {
    return SEED_KERNEL.find(t => t.id === id) ??
           [...this.theorems.values()].find(t => t.id === id) as any;
  }

  private axiomToLogic(theory: SeedTheory): SevenLogicValue {
    const map: Record<string, SevenLogicValue> = {
      'logic': 'TRUE', 'mathematics': 'TRUE', 'computation': 'TRUE',
      'consciousness': 'FLOWING', 'eastern-philosophy': 'BOTH',
      'quantum': 'NEITHER', 'cosmic': 'INFINITY',
      'general': 'ZERO', 'number-system': 'TRUE',
      'projection': 'FLOWING', 'ai-integration': 'TRUE',
    };
    return map[theory.category] ?? 'FLOWING';
  }
}
