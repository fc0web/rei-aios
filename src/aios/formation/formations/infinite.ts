/**
 * Rei AIOS — ∞ Infinite Formation（無限陣形）
 * Theme J: フォーメーションエンジン
 *
 * F-0根幹公理の最も直接的な実装。
 * Layer 4の出力がLayer 1（生成者）の入力になる自律進化ループ。
 *
 * 構造:
 *   Layer 1（生成者）: 新しいアイデア・コードを生成
 *       ↓
 *   Layer 2（評価者）: アイデアを評価・選別
 *       ↓
 *   Layer 3（実装者）: 選ばれたアイデアを実装
 *       ↓
 *   Layer 4（圧縮者）: 実装結果をRei圧縮・次のシードを生成
 *       ↓（ループ回数が残っていれば Layer 1 に戻る）
 *
 * F-0根幹公理との対応:
 *   「任意のRei実体Rは自らの構造S(R)を持ち、
 *    S(R)から次の実体R'が生成可能であり、
 *    この生成は原理的に終わらない」
 *
 * 適用場面:
 *   - 「Reiコードを段階的に改善し続けて」
 *   - 「アイデアを自律的に発展させて」
 *   - 「D-FUMT理論を自己拡張させて」
 */

import { BaseFormation, FormationType, FormationPlan, FormationStep } from '../formation-engine';
import { LayerInfo } from '../../layer/layer-manager';

export class InfiniteFormation extends BaseFormation {
  readonly type: FormationType = 'infinite';
  readonly name = '∞ 無限陣形';
  readonly description = 'F-0公理の自律進化ループ。層4の出力が層1の次の入力になる。';
  readonly minLayers = 4; // Layer 1, 2, 3, 4 が必要

  /**
   * ループ回数はパラメータで指定（デフォルト: 3回）
   */
  buildPlan(goal: string, _availableLayers: LayerInfo[]): FormationPlan {
    // 無限陣形は1サイクル分のステップを定義する
    // （FormationEngineが複数回呼ぶ場合は外部から制御）
    const steps: FormationStep[] = [
      // Phase 1: 生成（Generator）
      {
        layerId: 1,
        role: '生成者（Generator）',
        task: [
          `以下のゴールに対して、新しいアイデア・コード・理論を「生成」してください。`,
          `ゴール: "${goal}"`,
          ``,
          `生成の原則（F-0根幹公理に従う）:`,
          `1. 現在の状態から「次の状態」を生成する`,
          `2. 中心（本質）は保ちながら、周囲（表現）を拡張する`,
          `3. 生成物は評価者が評価できる形式で出力する`,
          ``,
          `【出力形式】`,
          `生成物A: [最も革新的なアイデア]`,
          `生成物B: [最も実用的なアイデア]`,
          `生成物C: [最も安全なアイデア]`,
        ].join('\n'),
      },
      // Phase 2: 評価（Evaluator）
      {
        layerId: 2,
        role: '評価者（Evaluator）',
        task: [
          `生成者が作った3つのアイデアを評価・選別してください。`,
          `ゴール: "${goal}"`,
          ``,
          `評価基準:`,
          `1. D-FUMT整合性: F-0根幹公理と矛盾していないか`,
          `2. 実現可能性: 現在のRei-AIOSで実装できるか`,
          `3. 価値創出: ユーザーの未来に貢献できるか`,
          `4. 革新性: 既存のものより優れているか`,
          ``,
          `【出力形式】`,
          `選択: 生成物[A/B/C]`,
          `理由: [選択した理由]`,
          `改善点: [実装者への具体的な指示]`,
        ].join('\n'),
        dependsOn: 1,
      },
      // Phase 3: 実装（Implementer）
      {
        layerId: 3,
        role: '実装者（Implementer）',
        task: [
          `評価者が選んだアイデアを具体的に実装してください。`,
          `ゴール: "${goal}"`,
          ``,
          `実装内容:`,
          `1. 評価者の指示に従って具体化する`,
          `2. Rei言語またはTypeScriptで実装コードを書く`,
          `3. テストケース・使用例を含める`,
          ``,
          `【出力形式】`,
          `実装コード:`,
          `\`\`\`typescript`,
          `// 実装内容`,
          `\`\`\``,
          ``,
          `使用例:`,
          `[具体的な使い方の説明]`,
        ].join('\n'),
        dependsOn: 2,
      },
      // Phase 4: 圧縮・次サイクルのシード生成（Compressor）
      {
        layerId: 4,
        role: '圧縮者・シード生成者（Compressor）',
        task: [
          `実装者の成果をRei圧縮し、次のサイクルのシードを生成してください。`,
          `ゴール: "${goal}"`,
          ``,
          `圧縮・進化の内容:`,
          `1. 実装成果の本質を抽出（Level 2意味圧縮）`,
          `2. このサイクルで学んだことの記録`,
          `3. 次のサイクルでさらに発展させるための「種」を生成`,
          ``,
          `F-0根幹公理の実現:`,
          `「現在の実体Rが次の実体R'の生成源になる」`,
          ``,
          `【出力形式】`,
          `サイクルの成果: [このサイクルで達成したこと]`,
          `圧縮エッセンス: [最も重要な学びを1〜3文で]`,
          `次サイクルのシード: [さらに発展させる方向性]`,
          `進化度: [0〜100%で前サイクルからの改善度]`,
        ].join('\n'),
        dependsOn: 3,
      },
    ];

    return {
      type: 'infinite',
      goal,
      coordination: 'Layer1(生成) → Layer2(評価) → Layer3(実装) → Layer4(圧縮) → [次サイクルへ]',
      steps,
    };
  }
}
