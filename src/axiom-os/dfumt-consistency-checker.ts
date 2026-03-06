/**
 * DFUMTConsistencyChecker — D-FUMT 全理論矛盾チェック
 *
 * SEED_KERNEL の75理論に対して:
 *   1. 全ペアの公理テキスト矛盾検出 (detectAxiomContradiction)
 *   2. カテゴリ内の論理値矛盾検出 (detect)
 *   3. 整合性スコアを七価論理で評価
 *   4. レポートを JSON で出力
 */

import { SEED_KERNEL, type SeedTheory } from './seed-kernel';
import { ContradictionDetector } from './contradiction-detector';
import { type SevenLogicValue, toSymbol } from './seven-logic';

export interface TheoryPairCheck {
  theoryA: string;     // id
  theoryB: string;     // id
  contradictionFound: boolean;
  kind?: string;
  description?: string;
}

export interface ConsistencyReport {
  totalTheories: number;
  totalPairsChecked: number;
  contradictionsFound: number;
  consistencyScore: number;      // 0.0〜1.0 (矛盾なし=1.0)
  overallTag: SevenLogicValue;   // 七価論理での全体評価
  contradictions: TheoryPairCheck[];
  categoryScores: Record<string, number>;  // カテゴリ別スコア
  checkedAt: string;
}

export class DFUMTConsistencyChecker {
  private detector = new ContradictionDetector();

  /**
   * 全75理論の矛盾チェックを実行する。
   *
   * 計算量: O(n²) = 75×74/2 = 2775ペア
   * 実行時間: 数百ミリ秒以内
   */
  checkAll(): ConsistencyReport {
    const theories = SEED_KERNEL;
    const contradictions: TheoryPairCheck[] = [];
    let pairsChecked = 0;

    // ── 全ペアチェック ──
    for (let i = 0; i < theories.length; i++) {
      for (let j = i + 1; j < theories.length; j++) {
        const a = theories[i];
        const b = theories[j];
        pairsChecked++;

        // 1. 公理テキストの矛盾チェック
        const textEntry = this.detector.detectAxiomContradiction(
          a.axiom, b.axiom, a.id, b.id,
        );
        if (textEntry) {
          contradictions.push({
            theoryA: a.id, theoryB: b.id,
            contradictionFound: true,
            kind: textEntry.kind,
            description: textEntry.description,
          });
          continue;
        }

        // 2. キーワード重複 + カテゴリ不一致 → 潜在的矛盾
        const keyOverlap = a.keywords.filter(k => b.keywords.includes(k)).length;
        if (keyOverlap >= 2 && a.category !== b.category) {
          // 同キーワードで異カテゴリ = 解釈の競合
          const lhsTag = this.categoryToLogic(a.category);
          const rhsTag = this.categoryToLogic(b.category);
          const entry = this.detector.detect(lhsTag, rhsTag, {
            theoryA: a.id, theoryB: b.id, sharedKeywords: a.keywords.filter(k => b.keywords.includes(k)),
          });
          if (entry) {
            contradictions.push({
              theoryA: a.id, theoryB: b.id,
              contradictionFound: true,
              kind: entry.kind,
              description: `共通キーワード[${a.keywords.filter(k => b.keywords.includes(k)).join(',')}]でカテゴリ競合: ${a.category} vs ${b.category}`,
            });
          }
        }
      }
    }

    // ── カテゴリ別スコア ──
    const categoryScores: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};
    const categoryContradictions: Record<string, number> = {};

    for (const t of theories) {
      categoryCounts[t.category] = (categoryCounts[t.category] ?? 0) + 1;
      categoryContradictions[t.category] = categoryContradictions[t.category] ?? 0;
    }
    for (const c of contradictions) {
      const a = theories.find(t => t.id === c.theoryA);
      if (a) categoryContradictions[a.category]++;
    }
    for (const [cat, count] of Object.entries(categoryCounts)) {
      const contra = categoryContradictions[cat] ?? 0;
      categoryScores[cat] = 1 - (contra / count);
    }

    const consistencyScore = pairsChecked > 0
      ? 1 - (contradictions.length / pairsChecked)
      : 1.0;

    // ── 全体七価評価 ──
    const overallTag: SevenLogicValue =
      contradictions.length === 0                  ? 'TRUE'     :
      contradictions.length <= 3                   ? 'FLOWING'  :
      contradictions.length <= 10                  ? 'BOTH'     :
      contradictions.some(c => c.kind === 'axiom') ? 'NEITHER'  :
                                                     'FALSE';

    return {
      totalTheories: theories.length,
      totalPairsChecked: pairsChecked,
      contradictionsFound: contradictions.length,
      consistencyScore,
      overallTag,
      contradictions,
      categoryScores,
      checkedAt: new Date().toISOString(),
    };
  }

  /** カテゴリ → 七価論理マッピング（競合検出用） */
  private categoryToLogic(category: string): SevenLogicValue {
    const map: Record<string, SevenLogicValue> = {
      'logic':          'TRUE',
      'mathematics':    'TRUE',
      'computation':    'TRUE',
      'consciousness':  'FLOWING',
      'eastern-philosophy': 'BOTH',
      'western-philosophy': 'BOTH',
      'quantum':        'NEITHER',
      'cosmic':         'INFINITY',
      'general':        'ZERO',
      'unified':        'FLOWING',
      'ai-integration': 'TRUE',
      'number-system':  'TRUE',
      'expansion':      'FLOWING',
      'projection':     'FLOWING',
    };
    return map[category] ?? 'NEITHER';
  }

  /** レポートを人間可読な文字列で出力 */
  formatReport(report: ConsistencyReport): string {
    const lines: string[] = [
      '═══ D-FUMT 全理論整合性レポート ═══',
      `実行日時    : ${report.checkedAt}`,
      `総理論数    : ${report.totalTheories}`,
      `検査ペア数  : ${report.totalPairsChecked}`,
      `矛盾件数    : ${report.contradictionsFound}`,
      `整合スコア  : ${(report.consistencyScore * 100).toFixed(1)}%`,
      `全体評価    : ${toSymbol(report.overallTag)} (${report.overallTag})`,
      '',
      '── カテゴリ別スコア ──',
    ];

    for (const [cat, score] of Object.entries(report.categoryScores).sort((a, b) => a[1] - b[1])) {
      const filled = Math.round(score * 10);
      const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(10 - filled);
      lines.push(`  ${cat.padEnd(20)} ${bar} ${(score * 100).toFixed(0)}%`);
    }

    if (report.contradictions.length > 0) {
      lines.push('', '── 検出された矛盾 ──');
      for (const c of report.contradictions) {
        lines.push(`  [${c.kind}] ${c.theoryA} <-> ${c.theoryB}`);
        if (c.description) lines.push(`    ${c.description}`);
      }
    } else {
      lines.push('', '矛盾なし — 全理論が整合しています');
    }

    return lines.join('\n');
  }
}
