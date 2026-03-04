/**
 * TheoryEvolution — 理論進化・種の自己更新エンジン
 *
 * D-FUMT「AI発見（§ad）」理論の具現化：
 *   - 既存75理論の使用頻度を追跡
 *   - 新理論の提案・検証・登録
 *   - 矛盾解決から新理論を生成
 *   - 世代管理（generation）で進化を記録
 *
 * 設計原則:
 *   - SEED_KERNEL は不変（イミュータブル）
 *   - 進化した理論は EVOLVED_KERNEL に追加
 *   - 七価論理で理論の「信頼度」を表現
 */

import { SEED_KERNEL, type SeedTheory } from './seed-kernel';
import type { ContradictionEntry } from './contradiction-detector';
import { type SevenLogicValue } from './seven-logic';

// ── 進化理論エントリ ──

export interface EvolvedTheory extends SeedTheory {
  generation: number;           // 世代番号（元75理論=0、派生=1,2,...）
  parentIds: string[];          // 親理論のID
  confidence: SevenLogicValue;  // 信頼度（七価論理）
  usageCount: number;           // 使用回数
  discoveredAt: number;         // 発見タイムスタンプ
  source: TheorySource;         // 発見の出所
  validated: boolean;           // 検証済みフラグ
}

export type TheorySource =
  | 'usage_pattern'      // 使用パターンから帰納
  | 'contradiction_resolved'  // 矛盾解決から生成
  | 'axiom_composition'  // 既存公理の合成
  | 'manual'             // 手動登録
  | 'ai_discovery';      // AI自律発見（§ad）

// ── 使用履歴 ──

export interface TheoryUsageLog {
  theoryId: string;
  usedAt: number;
  context?: string;
}

// ── TheoryEvolution 本体 ──

export class TheoryEvolution {
  /** 進化した新理論（世代1以上） */
  private readonly evolved: Map<string, EvolvedTheory> = new Map();
  /** 使用履歴 */
  private readonly usageLogs: TheoryUsageLog[] = [];
  /** 使用カウント */
  private readonly usageCounts: Map<string, number> = new Map();
  /** 次の世代番号 */
  private generation = 1;

  /** 全理論（元75 + 進化分）を返す */
  getAllTheories(): (SeedTheory | EvolvedTheory)[] {
    return [...SEED_KERNEL, ...this.evolved.values()];
  }

  /** 進化した理論のみ返す */
  getEvolved(): EvolvedTheory[] {
    return [...this.evolved.values()];
  }

  /** 検証済み理論のみ返す */
  getValidated(): EvolvedTheory[] {
    return this.getEvolved().filter(t => t.validated);
  }

  /**
   * 理論の使用を記録する
   * 使用頻度の高い理論は信頼度が上がる
   */
  recordUsage(theoryId: string, context?: string): void {
    this.usageLogs.push({ theoryId, usedAt: Date.now(), context });
    const count = (this.usageCounts.get(theoryId) ?? 0) + 1;
    this.usageCounts.set(theoryId, count);

    // 進化理論なら usageCount を更新
    const evolved = this.evolved.get(theoryId);
    if (evolved) {
      evolved.usageCount = count;
      // 10回以上使われたら信頼度を TRUE に昇格
      if (count >= 10) evolved.confidence = 'TRUE';
      else if (count >= 5) evolved.confidence = 'FLOWING';
    }
  }

  /**
   * 使用頻度の高い理論から新理論を帰納する
   * 上位2理論を合成して新理論候補を生成
   */
  induceFromUsage(): EvolvedTheory | null {
    const topTheories = [...this.usageCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2);

    if (topTheories.length < 2) return null;

    const [idA, countA] = topTheories[0];
    const [idB, countB] = topTheories[1];

    const seedA = this.findTheory(idA);
    const seedB = this.findTheory(idB);
    if (!seedA || !seedB) return null;

    return this.compose(seedA, seedB, 'usage_pattern');
  }

  /**
   * 矛盾解決エントリから新理論を生成する
   * 解決された矛盾は「新しい公理的真理」を示唆する
   */
  evolveFromContradiction(entry: ContradictionEntry): EvolvedTheory | null {
    if (entry.resolvedValue === undefined) return null;
    if (entry.resolvedValue === 'FLOWING') return null; // 未解決は除外

    const newId = `dfumt-evolved-${entry.id}`;
    const axiom = this.contradictionToAxiom(entry);
    const keywords = this.extractKeywords(entry);

    const theory: EvolvedTheory = {
      id: newId,
      axiom,
      category: 'general',
      keywords,
      generation: this.generation,
      parentIds: entry.axiomRef ? [entry.axiomRef] : [],
      confidence: this.resolvedValueToConfidence(entry.resolvedValue),
      usageCount: 0,
      discoveredAt: Date.now(),
      source: 'contradiction_resolved',
      validated: false,
    };

    this.evolved.set(newId, theory);
    return theory;
  }

  /**
   * 2つの既存理論を合成して新理論を提案する
   */
  compose(
    seedA: SeedTheory,
    seedB: SeedTheory,
    source: TheorySource = 'axiom_composition',
  ): EvolvedTheory {
    const newId = `dfumt-composed-${seedA.id.replace('dfumt-', '')}-${seedB.id.replace('dfumt-', '')}`;

    // 公理を合成：A ⊗ B（テンソル積的合成）
    const axiom = `(${seedA.axiom}) ⊗ (${seedB.axiom})`;

    // カテゴリは親のうち使用頻度が高い方を採用
    const countA = this.usageCounts.get(seedA.id) ?? 0;
    const category = countA >= (this.usageCounts.get(seedB.id) ?? 0)
      ? seedA.category : seedB.category;

    // キーワードをマージ（重複除去）
    const keywords = [...new Set([...seedA.keywords, ...seedB.keywords])].slice(0, 4);

    const theory: EvolvedTheory = {
      id: newId,
      axiom,
      category,
      keywords,
      generation: this.generation,
      parentIds: [seedA.id, seedB.id],
      confidence: 'ZERO',       // 新提案は未観測状態から開始
      usageCount: 0,
      discoveredAt: Date.now(),
      source,
      validated: false,
    };

    this.evolved.set(newId, theory);
    return theory;
  }

  /**
   * 理論を手動で登録する
   */
  register(
    seed: SeedTheory,
    parentIds: string[] = [],
    source: TheorySource = 'manual',
  ): EvolvedTheory {
    const theory: EvolvedTheory = {
      ...seed,
      generation: this.generation,
      parentIds,
      confidence: 'ZERO',
      usageCount: 0,
      discoveredAt: Date.now(),
      source,
      validated: false,
    };
    this.evolved.set(seed.id, theory);
    return theory;
  }

  /**
   * 理論を検証済みにする（信頼度を TRUE に昇格）
   */
  validate(theoryId: string): boolean {
    const theory = this.evolved.get(theoryId);
    if (!theory) return false;
    theory.validated = true;
    theory.confidence = 'TRUE';
    return true;
  }

  /**
   * 世代を進める
   */
  nextGeneration(): number {
    return ++this.generation;
  }

  /**
   * 進化状態のサマリーを返す
   */
  summarize(): {
    baseCount: number;
    evolvedCount: number;
    validatedCount: number;
    generation: number;
    mostUsed: string | null;
    totalUsage: number;
  } {
    const mostUsedEntry = [...this.usageCounts.entries()]
      .sort((a, b) => b[1] - a[1])[0];

    return {
      baseCount: SEED_KERNEL.length,
      evolvedCount: this.evolved.size,
      validatedCount: this.getValidated().length,
      generation: this.generation,
      mostUsed: mostUsedEntry?.[0] ?? null,
      totalUsage: this.usageLogs.length,
    };
  }

  // ── プライベートメソッド ──

  private findTheory(id: string): SeedTheory | undefined {
    return SEED_KERNEL.find(s => s.id === id) ?? this.evolved.get(id);
  }

  private contradictionToAxiom(entry: ContradictionEntry): string {
    const lhsSym = entry.lhs === 'TRUE' ? '⊤' : entry.lhs === 'FALSE' ? '⊥' : entry.lhs;
    const rhsSym = entry.rhs === 'TRUE' ? '⊤' : entry.rhs === 'FALSE' ? '⊥' : entry.rhs;
    const resSym = entry.resolvedValue === 'TRUE' ? '⊤'
      : entry.resolvedValue === 'FALSE' ? '⊥'
      : entry.resolvedValue ?? '〇';
    return `矛盾解決: ${lhsSym} ∧ ${rhsSym} →Ω ${resSym}`;
  }

  private extractKeywords(entry: ContradictionEntry): string[] {
    const kws: string[] = [`矛盾解決-${entry.kind}`];
    if (entry.axiomRef) kws.push(entry.axiomRef);
    return kws.slice(0, 3);
  }

  private resolvedValueToConfidence(v: SevenLogicValue): SevenLogicValue {
    if (v === 'TRUE' || v === 'FALSE') return 'FLOWING'; // 解決済みだが未検証
    if (v === 'NEITHER') return 'NEITHER';
    return 'ZERO';
  }
}
