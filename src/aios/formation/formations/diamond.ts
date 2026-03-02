/**
 * Rei AIOS — ◆ Diamond Formation（菱形陣形）
 * Theme J: フォーメーションエンジン
 *
 * 司令官が指示を出し、2つのLayerが並列で異なる仮説を検証し、
 * 統合者が結果をまとめる。
 *
 * 構造:
 *   Layer 1（司令官）: ユーザーと対話・方向性を決定
 *       ↓ 指示を分岐
 *   Layer 2（左翼）: 仮説Aを検証     Layer 3（右翼）: 仮説Bを検証
 *                     ↓ 並列実行 ↓
 *   Layer 4（統合者）: 両方の結果を比較・統合・最善案を提示
 *
 * 適用場面:
 *   - 「AとBのどちらが良いか検討して」
 *   - 「複数のアプローチを比較して最善を選んで」
 *   - 「D-FUMTの仮説を2つの角度から検証して」
 */

import { BaseFormation, FormationType, FormationPlan } from '../formation-engine';
import { LayerInfo } from '../../layer/layer-manager';

export class DiamondFormation extends BaseFormation {
  readonly type: FormationType = 'diamond';
  readonly name = '◆ 菱形陣形';
  readonly description = '2つの仮説を並列検証し統合。比較・選択タスクに最適。';
  readonly minLayers = 4; // Layer 1, 2, 3, 4 が必要

  buildPlan(goal: string, availableLayers: LayerInfo[]): FormationPlan {
    const layer1 = 1;
    const layer2 = 2;
    const layer3 = 3;
    const layer4 = 4;

    // ゴールから2つの仮説・アプローチを推定
    const hypothesis = this.extractHypotheses(goal);

    return {
      type: 'diamond',
      goal,
      coordination: `Layer1(指示) → Layer2・3(並列検証) → Layer4(統合)`,
      steps: [
        // Layer 1: 司令官として方向性を定義
        {
          layerId: layer1,
          role: '司令官',
          task: [
            `以下のゴールを分析し、検証すべき2つの主要アプローチを定義してください。`,
            `ゴール: "${goal}"`,
            ``,
            `出力形式:`,
            `- アプローチA: [具体的な検証方向]`,
            `- アプローチB: [具体的な検証方向]`,
            `- 評価基準: [どちらが優れているかの判断基準]`,
            ``,
            `この定義がLayer 2（左翼）とLayer 3（右翼）への指示になります。`,
          ].join('\n'),
        },
        // Layer 2: 左翼（仮説A）- Layer1の指示を受けて
        {
          layerId: layer2,
          role: '左翼（仮説A検証）',
          task: [
            `以下のゴールに対して、司令官の指示を受け取り「アプローチA」を徹底的に検証してください。`,
            `ゴール: "${goal}"`,
            `検証するアプローチ: ${hypothesis.a}`,
            ``,
            `検証内容:`,
            `1. アプローチAの詳細な実現方法`,
            `2. メリット・デメリット`,
            `3. 実現可能性・リスク評価`,
            `4. 具体的な実装例・サンプル`,
            ``,
            `検証結果を詳細にまとめてください。`,
          ].join('\n'),
          dependsOn: layer1, // 司令官の指示を受けてから開始
          parallel: false,   // Layer3と並列実行開始
        },
        // Layer 3: 右翼（仮説B）- Layer1の指示を受けて・Layer2と並列
        {
          layerId: layer3,
          role: '右翼（仮説B検証）',
          task: [
            `以下のゴールに対して、司令官の指示を受け取り「アプローチB」を徹底的に検証してください。`,
            `ゴール: "${goal}"`,
            `検証するアプローチ: ${hypothesis.b}`,
            ``,
            `検証内容:`,
            `1. アプローチBの詳細な実現方法`,
            `2. メリット・デメリット`,
            `3. 実現可能性・リスク評価`,
            `4. 具体的な実装例・サンプル`,
            ``,
            `検証結果を詳細にまとめてください。`,
          ].join('\n'),
          dependsOn: layer1, // 司令官の指示を受けてから開始
          parallel: true,    // Layer2と並列実行
        },
        // Layer 4: 統合者 - 両者の結果を統合
        {
          layerId: layer4,
          role: '統合者',
          task: [
            `以下のゴールに対して、左翼（仮説A）と右翼（仮説B）の検証結果を受け取り、最善案を提示してください。`,
            `ゴール: "${goal}"`,
            ``,
            `統合内容:`,
            `1. アプローチAとBの比較表（メリット/デメリット）`,
            `2. D-FUMT 中心-周囲パターンでの総合評価`,
            `3. 推奨する最善案（または両者の組み合わせ）`,
            `4. 具体的な実行ロードマップ`,
            ``,
            `最終結論を明確に提示してください。`,
          ].join('\n'),
          dependsOn: layer3, // 両Layerの完了後に開始（Layer3が最後に完了）
        },
      ],
    };
  }

  /**
   * ゴール文字列から2つの仮説を推定する（シンプルな実装）
   */
  private extractHypotheses(goal: string): { a: string; b: string } {
    // 「AとB」「AかB」パターンの抽出を試みる
    const vsMatch = goal.match(/(.+?)(?:と|か|vs\.?|or|VS)(.+)/i);
    if (vsMatch) {
      return {
        a: vsMatch[1].trim(),
        b: vsMatch[2].trim(),
      };
    }

    // デフォルト: 目的志向アプローチ vs 手段志向アプローチ
    return {
      a: `「${goal}」に対する直接的・最短アプローチ`,
      b: `「${goal}」に対する段階的・安全重視アプローチ`,
    };
  }
}
