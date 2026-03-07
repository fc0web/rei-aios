/**
 * ReiDistributedBus — 分散コンピューティング設計
 *
 * D-FUMT Theory #71: マヤ分散暦理論
 * 「複数の独立したプロセスは同期点（最小公倍数）で合意する」
 *
 * アーキテクチャ:
 *   ノード1（rei-pl実行）  --+
 *   ノード2（Bio-AI）      --+-> DistributedBus -> 合意値（七価）
 *   ノード3（PCセンサー）  --+
 *
 * 合意アルゴリズム（七価論理多数決）:
 *   全ノードTRUE     -> TRUE
 *   過半数TRUE       -> FLOWING（収束中）
 *   矛盾あり         -> BOTH
 *   全ノードFALSE    -> FALSE
 *   全ノードZERO     -> ZERO（未観測）
 */

import { type SevenLogicValue } from './seven-logic';

export interface DistributedNode {
  id: string;
  weight: number;       // 投票重み（0.0〜1.0）
  lastValue: SevenLogicValue;
  lastUpdated: number;
  ttlMs: number;        // この値の有効期間（期限切れ->ZERO）
}

export interface ConsensusResult {
  value: SevenLogicValue;       // 合意値
  confidence: number;           // 合意の確信度（0〜1）
  participatingNodes: string[]; // 有効期限内のノード
  expiredNodes: string[];       // 期限切れノード
  method: string;               // 使用した合意方式
}

export class ReiDistributedBus {
  private nodes: Map<string, DistributedNode> = new Map();

  /** ノードを登録 */
  registerNode(id: string, weight = 1.0, ttlMs = 60_000): void {
    this.nodes.set(id, {
      id, weight,
      lastValue: 'ZERO',
      lastUpdated: 0,
      ttlMs,
    });
  }

  /** ノードの値を更新 */
  update(nodeId: string, value: SevenLogicValue): void {
    const node = this.nodes.get(nodeId);
    if (!node) throw new Error(`ノード未登録: ${nodeId}`);
    node.lastValue = value;
    node.lastUpdated = Date.now();
  }

  /**
   * 七価論理多数決で合意値を計算する
   *
   * 重み付き投票:
   *   各値の重みの合計を計算
   *   最大重みの値が勝者
   *   ただし矛盾（TRUE+FALSE）があればBOTH
   */
  consensus(): ConsensusResult {
    const now = Date.now();
    const active: DistributedNode[] = [];
    const expired: string[] = [];

    for (const node of this.nodes.values()) {
      if (node.lastUpdated === 0 || now - node.lastUpdated > node.ttlMs) {
        expired.push(node.id);
      } else {
        active.push(node);
      }
    }

    if (active.length === 0) {
      return {
        value: 'ZERO', confidence: 0,
        participatingNodes: [],
        expiredNodes: expired,
        method: 'default-zero',
      };
    }

    // 重み付き投票集計
    const weights: Record<SevenLogicValue, number> = {
      TRUE: 0, FALSE: 0, BOTH: 0, NEITHER: 0,
      INFINITY: 0, ZERO: 0, FLOWING: 0,
    };
    let totalWeight = 0;

    for (const node of active) {
      weights[node.lastValue] += node.weight;
      totalWeight += node.weight;
    }

    // 矛盾検出
    if (weights.TRUE > 0 && weights.FALSE > 0) {
      return {
        value: 'BOTH',
        confidence: 1 - Math.abs(weights.TRUE - weights.FALSE) / totalWeight,
        participatingNodes: active.map(n => n.id),
        expiredNodes: expired,
        method: 'contradiction-detected',
      };
    }

    // 最大重み値を選択
    const winner = (Object.entries(weights) as [SevenLogicValue, number][])
      .sort((a, b) => b[1] - a[1])[0];

    const confidence = winner[1] / totalWeight;

    // 過半数未満 -> FLOWING（収束中）
    const value: SevenLogicValue = confidence >= 0.5 ? winner[0] : 'FLOWING';

    return {
      value,
      confidence,
      participatingNodes: active.map(n => n.id),
      expiredNodes: expired,
      method: confidence >= 0.5 ? 'weighted-majority' : 'flowing-convergence',
    };
  }

  /** 全ノードの状態を返す */
  getNodes(): DistributedNode[] {
    return [...this.nodes.values()];
  }
}
