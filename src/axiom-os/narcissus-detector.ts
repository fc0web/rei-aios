/**
 * NarcissusDetector — 自己参照ループ・盲点検出（メタ認知層）
 *
 * D-FUMT Theory #75: ナルキッソス自己参照理論
 * 「推論プロセスが自己を参照するとき、
 *  ループ・バイアス・盲点が生まれる」
 *
 * 検出パターン:
 *   1. 循環参照（A->B->C->A）
 *   2. 同一公理の過剰使用（依存偏重）
 *   3. 結論が前提を循環的に支持する
 *   4. 七価値が振動して収束しない
 *   5. 矛盾を検出しているのに矛盾検出自体に矛盾がある
 */

import { type SevenLogicValue } from './seven-logic';

// ── ループの種別 ──
export type LoopKind =
  | 'circular_reference'  // 循環参照 A->B->C->A
  | 'axiom_overuse'       // 公理過剰依存
  | 'self_supporting'     // 結論が前提を支持
  | 'value_oscillation'   // 七価値の振動
  | 'meta_contradiction'; // メタレベルの矛盾

// ── 盲点レポート ──
export interface BlindSpotReport {
  detected: boolean;
  loops: LoopRecord[];
  overusedAxioms: string[];
  oscillationPatterns: OscillationPattern[];
  riskLevel: SevenLogicValue;  // ZERO=安全, FLOWING=注意, BOTH=危険, INFINITY=致命的
  recommendation: string;
}

export interface LoopRecord {
  kind: LoopKind;
  path: string[];          // ループのパス（axiomId[]）
  detectedAt: number;
  severity: SevenLogicValue;
  description: string;
}

export interface OscillationPattern {
  axiomId: string;
  values: SevenLogicValue[];  // 直近の値の列
  period: number;             // 振動周期（ステップ数）
  isOscillating: boolean;
}

export class NarcissusDetector {
  // axiomId -> 使用回数
  private usageCounts: Map<string, number> = new Map();
  // axiomId -> 直近の出力値履歴
  private valueHistory: Map<string, SevenLogicValue[]> = new Map();
  // 参照グラフ（axiomId -> 参照先axiomId[]）
  private refGraph: Map<string, Set<string>> = new Map();
  private loops: LoopRecord[] = [];

  // ══════════════════════════════════════════════════════════════
  // 観測: 推論ステップを記録する
  // ══════════════════════════════════════════════════════════════

  /**
   * 推論ステップを記録する。
   * ExplainabilityEngine の ReasoningStep と連携して使う。
   */
  observe(axiomId: string, outputValue: SevenLogicValue, refs: string[] = []): void {
    // 使用回数
    this.usageCounts.set(axiomId, (this.usageCounts.get(axiomId) ?? 0) + 1);

    // 値履歴（直近10件）
    const hist = this.valueHistory.get(axiomId) ?? [];
    hist.push(outputValue);
    if (hist.length > 10) hist.shift();
    this.valueHistory.set(axiomId, hist);

    // 参照グラフ
    if (!this.refGraph.has(axiomId)) this.refGraph.set(axiomId, new Set());
    for (const ref of refs) {
      this.refGraph.get(axiomId)!.add(ref);
    }
  }

  // ══════════════════════════════════════════════════════════════
  // 検出: 盲点・ループを分析する
  // ══════════════════════════════════════════════════════════════

  /**
   * 全パターンを検出し、盲点レポートを返す
   */
  analyze(): BlindSpotReport {
    this.loops = [];

    const circular = this.detectCircular();
    const overused = this.detectOveruse();
    const oscillations = this.detectOscillation();

    const allLoops = [...circular, ...this.loops];
    const hasLoops = allLoops.length > 0;
    const hasOveruse = overused.length > 0;
    const hasOscillation = oscillations.some(o => o.isOscillating);

    // リスクレベルの算出
    const riskLevel: SevenLogicValue =
      allLoops.some(l => l.kind === 'circular_reference') ? 'INFINITY' :
      hasLoops && hasOscillation                           ? 'BOTH'     :
      hasLoops || hasOscillation                           ? 'FLOWING'  :
      hasOveruse                                           ? 'NEITHER'  :
                                                             'ZERO';

    const recommendation = this.makeRecommendation(riskLevel, allLoops, overused);

    return {
      detected: riskLevel !== 'ZERO',
      loops: allLoops,
      overusedAxioms: overused,
      oscillationPatterns: oscillations,
      riskLevel,
      recommendation,
    };
  }

  // ── 循環参照検出（DFS） ──
  private detectCircular(): LoopRecord[] {
    const records: LoopRecord[] = [];
    const visited = new Set<string>();
    const stack: string[] = [];

    const dfs = (node: string): boolean => {
      if (stack.includes(node)) {
        // ループ発見
        const loopStart = stack.indexOf(node);
        const path = [...stack.slice(loopStart), node];
        records.push({
          kind: 'circular_reference',
          path,
          detectedAt: Date.now(),
          severity: 'INFINITY',
          description: `循環参照: ${path.join(' -> ')}`,
        });
        return true;
      }
      if (visited.has(node)) return false;
      visited.add(node);
      stack.push(node);
      const refs = this.refGraph.get(node) ?? new Set();
      for (const ref of refs) {
        dfs(ref);
      }
      stack.pop();
      return false;
    };

    for (const node of this.refGraph.keys()) {
      visited.clear();
      dfs(node);
    }
    return records;
  }

  // ── 公理過剰使用検出 ──
  private detectOveruse(threshold = 10): string[] {
    const overused: string[] = [];
    for (const [axiomId, count] of this.usageCounts) {
      if (count > threshold) {
        overused.push(axiomId);
        this.loops.push({
          kind: 'axiom_overuse',
          path: [axiomId],
          detectedAt: Date.now(),
          severity: 'FLOWING',
          description: `公理「${axiomId}」が${count}回使用（閾値: ${threshold}）`,
        });
      }
    }
    return overused;
  }

  // ── 七価値振動検出 ──
  private detectOscillation(): OscillationPattern[] {
    const patterns: OscillationPattern[] = [];
    for (const [axiomId, hist] of this.valueHistory) {
      if (hist.length < 4) continue;

      // A-B-A-B パターンの検出
      let oscillating = false;
      let period = 0;
      for (let p = 1; p <= Math.floor(hist.length / 2); p++) {
        const matches = hist.every((v, i) => {
          if (i < p) return true;
          return v === hist[i % p];
        });
        if (matches) { oscillating = true; period = p; break; }
      }

      patterns.push({
        axiomId,
        values: [...hist],
        period,
        isOscillating: oscillating,
      });

      if (oscillating) {
        this.loops.push({
          kind: 'value_oscillation',
          path: [axiomId],
          detectedAt: Date.now(),
          severity: 'BOTH',
          description: `「${axiomId}」が周期${period}で振動: [${hist.slice(-4).join(',')}]`,
        });
      }
    }
    return patterns;
  }

  private makeRecommendation(
    risk: SevenLogicValue,
    loops: LoopRecord[],
    overused: string[],
  ): string {
    if (risk === 'ZERO') return '盲点なし——推論は健全です';
    if (risk === 'INFINITY') {
      return `【重大】循環参照を検出しました。` +
             `MoiraTerminator.atropos() で強制終了を推奨します。`;
    }
    if (risk === 'BOTH') {
      return `【警告】ループと振動が同時発生しています。` +
             `AriadneTracer でトレースを逆引きし、起点を特定してください。`;
    }
    if (overused.length > 0) {
      return `【注意】公理「${overused.join(', ')}」への過剰依存。` +
             `他の公理との組み合わせを検討してください。`;
    }
    return '軽微なパターンを検出。監視を継続してください。';
  }

  reset(): void {
    this.usageCounts.clear();
    this.valueHistory.clear();
    this.refGraph.clear();
    this.loops = [];
  }
}
