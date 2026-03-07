/**
 * Rei-AIOS — ReiPLAxiomGenerator
 * SEED_KERNELの公理からRei-PLコードを生成する。
 *
 * 変換ルール（公理カテゴリ → Rei-PLパターン）:
 *   logic          → logic7/logic4 型付き式
 *   mathematics    → 数値計算・関数定義
 *   computation    → pipe chain・再帰
 *   consciousness  → 意識値
 *   quantum        → BOTH型・重ね合わせ表現
 *   ai-integration → 自己参照
 *   zero_extension → 未定義ハンドリング
 *   general        → 基本定義式
 */

import type { SeedTheory } from './seed-kernel';

export interface GeneratedCode {
  theoryId:  string;
  category:  string;
  axiom:     string;
  reiCode:   string;       // 生成されたRei-PLソースコード
  template:  string;       // 使用したテンプレート名
}

// ─── Rei-PLコードテンプレート ─────────────────────────────

function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
}

const TEMPLATES: Record<string, (theory: SeedTheory) => string> = {

  logic: (t) => `
// ${t.id}: ${t.axiom}
let axiom_${sanitizeId(t.id)} = (x: logic7) =>
  if x == TRUE { TRUE }
  else if x == NEITHER { NEITHER }
  else { FLOWING }
`.trim(),

  mathematics: (t) => `
// ${t.id}: ${t.axiom}
let compute_${sanitizeId(t.id)} = (n: i64) =>
  n |> (x => x * x) |> (x => x + 1)
`.trim(),

  computation: (t) => `
// ${t.id}: ${t.axiom}
let transform_${sanitizeId(t.id)} = (xs: i64) =>
  xs |> (x => x + 1) |> (x => x * 2)
`.trim(),

  consciousness: (t) => `
// ${t.id}: ${t.axiom}
// phi > 0 は意識の統合情報理論（IIT）を表す
let phi_${sanitizeId(t.id)} = (phi: f64) =>
  if phi > 0.0 { TRUE }
  else { ZERO }
`.trim(),

  quantum: (t) => `
// ${t.id}: ${t.axiom}
// 量子重ね合わせ BOTH型
let quantum_${sanitizeId(t.id)} = (state: logic7) =>
  if state == BOTH { BOTH }
  else if state == FLOWING { FLOWING }
  else { state }
`.trim(),

  'ai-integration': (t) => `
// ${t.id}: ${t.axiom}
// 冪等収束（自己参照）
let omega_${sanitizeId(t.id)} = (x: i64) =>
  x |> (n => n + 1) |> (n => n)
`.trim(),

  zero_extension: (t) => `
// ${t.id}: ${t.axiom}
// ZERO値: 未定義・潜在状態
let zero_ext_${sanitizeId(t.id)} = (x: logic7) =>
  if x == ZERO { TRUE }
  else { x }
`.trim(),

  numerical: (t) => `
// ${t.id}: ${t.axiom}
// D-FUMT数値処理: 螺旋数・区間演算
let numerical_${sanitizeId(t.id)} = (x: f64) =>
  x |> (n => n * 3.14159265) |> (n => if n > 0.0 { TRUE } else { ZERO })
`.trim(),

  general: (t) => `
// ${t.id}: ${t.axiom}
let theory_${sanitizeId(t.id)} = (x: i64) => x
`.trim(),

};

// ─── メインクラス ─────────────────────────────────────────

export class ReiPLAxiomGenerator {
  /**
   * 1理論 → Rei-PLコードを生成する
   */
  generate(theory: SeedTheory): GeneratedCode {
    const template = TEMPLATES[theory.category] ?? TEMPLATES['general'];
    const reiCode  = template(theory);

    return {
      theoryId: theory.id,
      category: theory.category,
      axiom:    theory.axiom,
      reiCode,
      template: theory.category in TEMPLATES ? theory.category : 'general',
    };
  }

  /**
   * 複数理論 → Rei-PLコードリストを生成する
   */
  generateBatch(theories: SeedTheory[]): GeneratedCode[] {
    return theories.map(t => this.generate(t));
  }

  /**
   * 複数理論を1ファイルにまとめたRei-PLコードを生成する
   */
  generateModule(theories: SeedTheory[], moduleName = 'dfumt_axioms'): string {
    const codes = theories.map(t => this.generate(t).reiCode);
    return [
      `// Rei-AIOS: ${moduleName}`,
      `// D-FUMT公理モジュール（${theories.length}理論）`,
      `// 自動生成 ${new Date().toISOString()}`,
      '',
      ...codes,
    ].join('\n\n');
  }
}
