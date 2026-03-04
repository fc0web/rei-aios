/**
 * ContradictionDetector — 七価論理に基づく矛盾検出・保留エンジン
 *
 * D-FUMT理論の核心：
 *   - BOTH（真かつ偽）= 矛盾の許容（龍樹・中論の不一不異）
 *   - FLOWING（流動）= 矛盾を保留し、後で解決する状態
 *   - Ω（収束）= 矛盾をいずれかに収束させる操作
 *
 * 検出対象：
 *   1. 値の矛盾: 同一キーに BOTH が存在する
 *   2. 論理的矛盾: P と ¬P が同時に真
 *   3. 公理矛盾: 2つの公理が相互に否定し合う
 *   4. 時間矛盾: past と future が整合しない
 */

import {
  SevenLogicValue,
  not, and, or,
  toSymbol, fromSymbol,
} from './seven-logic';

// ── 矛盾の種類 ──

export type ContradictionKind =
  | 'value'    // 値の直接矛盾（BOTH）
  | 'logical'  // P ∧ ¬P
  | 'axiom'    // 公理間の相互否定
  | 'temporal' // 時間軸の不整合
  | 'flow';    // FLOWING 状態（解決待ち）

// ── 矛盾エントリ ──

export interface ContradictionEntry {
  id: string;                    // ユニークID（タイムスタンプ+連番）
  kind: ContradictionKind;       // 矛盾の種類
  description: string;           // 人間可読な説明
  lhs: SevenLogicValue;          // 左辺の値
  rhs: SevenLogicValue;          // 右辺の値
  result: SevenLogicValue;       // 検出時の結果（通常 BOTH）
  pending: SevenLogicValue;      // 保留値（通常 FLOWING）
  resolvedValue?: SevenLogicValue; // 解決後の値（未解決なら undefined）
  resolvedAt?: number;           // 解決タイムスタンプ
  createdAt: number;             // 検出タイムスタンプ
  axiomRef?: string;             // 関連公理ID（あれば）
  context?: Record<string, unknown>; // 追加コンテキスト
}

// ── 解決戦略 ──

export type ResolutionStrategy =
  | 'omega_convergence'   // Ω収束: BOTH→⊤（肯定側に収束）
  | 'collapse_true'       // ⊤に強制解決
  | 'collapse_false'      // ⊥に強制解決
  | 'collapse_neither'    // neither（無記）として扱う
  | 'keep_flowing'        // ～のまま保留継続
  | 'escalate';           // 解決不能、ユーザーへ委任

export interface ResolutionResult {
  entry: ContradictionEntry;
  strategy: ResolutionStrategy;
  resolvedValue: SevenLogicValue;
  confidence: number;   // 0.0〜1.0
  reason: string;
}

// ── ContradictionDetector 本体 ──

export class ContradictionDetector {
  private readonly pending: Map<string, ContradictionEntry> = new Map();
  private counter = 0;

  /** 矛盾IDを生成 */
  private nextId(): string {
    return `cd-${Date.now()}-${++this.counter}`;
  }

  /**
   * 値の矛盾を検出する
   * lhs と rhs が論理的に矛盾する場合に ContradictionEntry を返す
   */
  detect(
    lhs: SevenLogicValue,
    rhs: SevenLogicValue,
    context?: Record<string, unknown>,
  ): ContradictionEntry | null {
    const combined = and(lhs, rhs);

    // BOTH（矛盾）または相互否定を検出
    const isContradiction =
      combined === 'BOTH' ||
      (lhs === 'TRUE' && rhs === 'FALSE') ||
      (lhs === 'FALSE' && rhs === 'TRUE') ||
      rhs === not(lhs);

    if (!isContradiction) return null;

    const entry: ContradictionEntry = {
      id: this.nextId(),
      kind: this.classifyKind(lhs, rhs),
      description: this.describe(lhs, rhs),
      lhs,
      rhs,
      result: 'BOTH',
      pending: 'FLOWING',  // 保留状態として FLOWING に設定
      createdAt: Date.now(),
      context,
    };

    this.pending.set(entry.id, entry);
    return entry;
  }

  /**
   * 公理文字列の矛盾を検出する（テキストベース）
   * 同一概念に肯定・否定の公理が存在する場合
   */
  detectAxiomContradiction(
    axiomA: string,
    axiomB: string,
    axiomRefA?: string,
    axiomRefB?: string,
  ): ContradictionEntry | null {
    // 簡易的な矛盾検出：一方が他方の否定形を含む
    const negationPatterns = [
      [/^(.+)は真$/, /^(.+)は偽$/],
      [/^(.+)が存在する$/, /^(.+)が存在しない$/],
      [/^(.+)は可能$/, /^(.+)は不可能$/],
    ];

    for (const [posPattern, negPattern] of negationPatterns) {
      const posMatch = axiomA.match(posPattern);
      const negMatch = axiomB.match(negPattern);
      if (posMatch && negMatch && posMatch[1] === negMatch[1]) {
        const entry: ContradictionEntry = {
          id: this.nextId(),
          kind: 'axiom',
          description: `公理矛盾: 「${axiomA}」と「${axiomB}」が相互否定`,
          lhs: 'TRUE',
          rhs: 'FALSE',
          result: 'BOTH',
          pending: 'FLOWING',
          createdAt: Date.now(),
          axiomRef: axiomRefA,
          context: { axiomA, axiomB, axiomRefA, axiomRefB },
        };
        this.pending.set(entry.id, entry);
        return entry;
      }
    }
    return null;
  }

  /**
   * 時間矛盾を検出する
   * past値とfuture値が整合しない場合
   */
  detectTemporalContradiction(
    pastValue: SevenLogicValue,
    futureValue: SevenLogicValue,
    context?: Record<string, unknown>,
  ): ContradictionEntry | null {
    // past=⊤ なのに future=⊥ は時間的矛盾
    const isTemporalContradiction =
      (pastValue === 'TRUE' && futureValue === 'FALSE') ||
      (pastValue === 'FALSE' && futureValue === 'TRUE') ||
      (pastValue === 'BOTH' && futureValue !== 'BOTH');

    if (!isTemporalContradiction) return null;

    const entry: ContradictionEntry = {
      id: this.nextId(),
      kind: 'temporal',
      description: `時間矛盾: past=${toSymbol(pastValue)}, future=${toSymbol(futureValue)}`,
      lhs: pastValue,
      rhs: futureValue,
      result: 'BOTH',
      pending: 'FLOWING',
      createdAt: Date.now(),
      context,
    };
    this.pending.set(entry.id, entry);
    return entry;
  }

  /**
   * 矛盾を解決する
   * strategy に従って resolvedValue を決定し、pending から除去
   */
  resolve(
    id: string,
    strategy: ResolutionStrategy,
  ): ResolutionResult | null {
    const entry = this.pending.get(id);
    if (!entry) return null;

    const resolvedValue = this.applyStrategy(entry, strategy);
    const confidence = this.calcConfidence(strategy, entry);
    const reason = this.describeResolution(strategy, entry);

    const resolved: ContradictionEntry = {
      ...entry,
      resolvedValue,
      resolvedAt: Date.now(),
      pending: resolvedValue,
    };
    this.pending.set(id, resolved);

    return { entry: resolved, strategy, resolvedValue, confidence, reason };
  }

  /**
   * Ω収束による自動解決を試みる
   * 全 FLOWING エントリに対して最適な戦略を選択
   */
  autoResolve(): ResolutionResult[] {
    const results: ResolutionResult[] = [];

    for (const [id, entry] of this.pending) {
      if (entry.resolvedValue !== undefined) continue; // 既解決はスキップ

      const strategy = this.selectStrategy(entry);
      const result = this.resolve(id, strategy);
      if (result) results.push(result);
    }

    return results;
  }

  /** 未解決の矛盾一覧を返す */
  getPending(): ContradictionEntry[] {
    return [...this.pending.values()].filter(e => e.resolvedValue === undefined);
  }

  /** 全エントリ（解決済み含む）を返す */
  getAll(): ContradictionEntry[] {
    return [...this.pending.values()];
  }

  /** 特定IDのエントリを取得 */
  get(id: string): ContradictionEntry | undefined {
    return this.pending.get(id);
  }

  /** 未解決エントリを七価論理サマリーで返す */
  summarize(): {
    total: number;
    pending: number;
    resolved: number;
    byKind: Record<ContradictionKind, number>;
    dominantState: SevenLogicValue;
  } {
    const all = this.getAll();
    const pendingList = this.getPending();
    const byKind: Record<ContradictionKind, number> = {
      value: 0, logical: 0, axiom: 0, temporal: 0, flow: 0,
    };
    for (const e of pendingList) byKind[e.kind]++;

    // 未解決が多い = FLOWING、解決済みが多い = BOTH→⊤/⊥
    const dominantState: SevenLogicValue =
      pendingList.length === 0 ? 'TRUE' :
      pendingList.length < 3   ? 'FLOWING' : 'BOTH';

    return {
      total: all.length,
      pending: pendingList.length,
      resolved: all.length - pendingList.length,
      byKind,
      dominantState,
    };
  }

  // ── プライベートメソッド ──

  private classifyKind(lhs: SevenLogicValue, rhs: SevenLogicValue): ContradictionKind {
    if (lhs === 'FLOWING' || rhs === 'FLOWING') return 'flow';
    if (lhs === 'BOTH' || rhs === 'BOTH')       return 'value';
    return 'logical';
  }

  private describe(lhs: SevenLogicValue, rhs: SevenLogicValue): string {
    return `論理矛盾: ${toSymbol(lhs)} ∧ ${toSymbol(rhs)} = ${toSymbol('BOTH')}`;
  }

  private applyStrategy(
    entry: ContradictionEntry,
    strategy: ResolutionStrategy,
  ): SevenLogicValue {
    switch (strategy) {
      case 'omega_convergence': return 'TRUE';   // Ω: BOTH→⊤
      case 'collapse_true':     return 'TRUE';
      case 'collapse_false':    return 'FALSE';
      case 'collapse_neither':  return 'NEITHER';
      case 'keep_flowing':      return 'FLOWING';
      case 'escalate':          return 'FLOWING'; // ユーザー委任=保留継続
    }
  }

  private calcConfidence(strategy: ResolutionStrategy, entry: ContradictionEntry): number {
    switch (strategy) {
      case 'omega_convergence': return 0.75;
      case 'collapse_true':     return entry.lhs === 'TRUE' ? 0.9 : 0.5;
      case 'collapse_false':    return entry.lhs === 'FALSE' ? 0.9 : 0.5;
      case 'collapse_neither':  return 0.6;
      case 'keep_flowing':      return 0.4;
      case 'escalate':          return 0.0;
    }
  }

  private describeResolution(strategy: ResolutionStrategy, entry: ContradictionEntry): string {
    switch (strategy) {
      case 'omega_convergence': return `Ω収束: ${toSymbol('BOTH')} → ⊤（冪等性理論による安定化）`;
      case 'collapse_true':     return `⊤に強制解決: 肯定側を採用`;
      case 'collapse_false':    return `⊥に強制解決: 否定側を採用`;
      case 'collapse_neither':  return `無記（neither）として保留解除`;
      case 'keep_flowing':      return `～のまま保留継続: 追加情報を待機`;
      case 'escalate':          return `解決不能: ユーザーへ委任`;
    }
  }

  private selectStrategy(entry: ContradictionEntry): ResolutionStrategy {
    // 時間矛盾はneither（判断留保）
    if (entry.kind === 'temporal') return 'collapse_neither';
    // 公理矛盾はユーザー委任
    if (entry.kind === 'axiom') return 'escalate';
    // 古い矛盾（5秒以上）はΩ収束
    if (Date.now() - entry.createdAt > 5000) return 'omega_convergence';
    // それ以外は保留継続
    return 'keep_flowing';
  }
}
