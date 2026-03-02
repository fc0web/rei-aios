/**
 * Rei AIOS — ▲ Triangle Formation（三角陣形）
 * Theme J: フォーメーションエンジン
 *
 * 最も基本的なフォーメーション。
 * 3つのLayerが「情報の流れ」に沿って順次連携する。
 *
 * 構造:
 *   Layer 2（研究者）: Web調査・情報収集
 *       ↓ 情報を渡す
 *   Layer 3（分析者）: D-FUMT分析・構造化
 *       ↓ 分析結果を渡す
 *   Layer 4（実行者）: Rei-Automatorで具体的に実行
 *
 * 適用場面:
 *   - 「〇〇について調べて、まとめてレポートを作って」
 *   - 「〇〇のデータを分析して自動化スクリプトを作成して」
 *   - 「arXivの最新論文を調べて、D-FUMTで分析して」
 */

import { BaseFormation, FormationType, FormationPlan } from '../formation-engine';
import { LayerInfo } from '../../layer/layer-manager';

export class TriangleFormation extends BaseFormation {
  readonly type: FormationType = 'triangle';
  readonly name = '▲ 三角陣形';
  readonly description = '調査→分析→実行の順次連携。最も基本的なフォーメーション。';
  readonly minLayers = 3; // Layer 2, 3, 4 が必要

  buildPlan(goal: string, availableLayers: LayerInfo[]): FormationPlan {
    // 利用可能なLayerから 2, 3, 4 を使用
    const layer2 = availableLayers.find(l => l.id === 2)?.id ?? 2;
    const layer3 = availableLayers.find(l => l.id === 3)?.id ?? 3;
    const layer4 = availableLayers.find(l => l.id === 4)?.id ?? 4;

    return {
      type: 'triangle',
      goal,
      coordination: `Layer${layer2}(調査) → Layer${layer3}(分析) → Layer${layer4}(実行)`,
      steps: [
        {
          layerId: layer2,
          role: '研究者',
          task: [
            `以下のゴールに関連する情報を収集・調査してください。`,
            `ゴール: "${goal}"`,
            ``,
            `調査内容:`,
            `1. 関連する最新情報・データの収集`,
            `2. 重要なキーワード・概念の特定`,
            `3. 信頼できる情報源の列挙`,
            ``,
            `調査結果を構造化してまとめてください。`,
          ].join('\n'),
        },
        {
          layerId: layer3,
          role: '分析者（D-FUMT）',
          task: [
            `以下のゴールに対して、研究者の調査結果を受け取りD-FUMT分析を行ってください。`,
            `ゴール: "${goal}"`,
            ``,
            `D-FUMT 中心-周囲パターンでの分析:`,
            `1. 中心 = このゴールの本質は何か`,
            `2. 周囲 = 関連する要素・変数・制約条件`,
            `3. 構造化 = 実行可能なステップへの変換`,
            `4. 優先順位 = 最も重要なアクションを特定`,
            ``,
            `分析結果と具体的な実行計画を提示してください。`,
          ].join('\n'),
          dependsOn: layer2, // Layer2の調査結果を受け取る
        },
        {
          layerId: layer4,
          role: '実行者',
          task: [
            `以下のゴールに対して、分析者の実行計画を受け取り、Rei言語スクリプトまたは具体的な実行手順を作成してください。`,
            `ゴール: "${goal}"`,
            ``,
            `実行内容:`,
            `1. 分析結果に基づいた具体的なReiスクリプトまたは手順の作成`,
            `2. エラーハンドリング・例外処理の組み込み`,
            `3. 実行結果の検証方法の提示`,
            ``,
            `実行可能な形で出力してください。`,
          ].join('\n'),
          dependsOn: layer3, // Layer3の分析結果を受け取る
        },
      ],
    };
  }
}
