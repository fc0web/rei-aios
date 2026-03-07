/**
 * DependentOrigination — 縁起論エンジン
 *
 * 龍樹の pratītyasamutpāda（縁起）を形式実装する。
 * 「全ての存在は相互依存によって生起する」
 *
 * NagarjunaProof（四不生）の結論: 独立した自性はない（NEITHER）
 * DependentOrigination の主張: 関係性のみが存在する（FLOWING）
 *
 * 七価対応:
 *   ZERO    -> 依存関係が0: 存在できない
 *   FLOWING -> 依存関係が変化中: 生起の過程
 *   TRUE    -> 依存関係が安定: 存在が成立
 *   BOTH    -> 循環依存: 縁起の特殊形態（許容）
 *   INFINITY-> 無限依存連鎖: 原因の遡及（阻止）
 *   NEITHER -> 依存関係が問えない: 空（śūnyatā）
 *   FALSE   -> 依存関係が断絶: 滅（nirodha）
 *
 * @author Nobuki Fujimoto (D-FUMT) + Claude
 */

import { type SevenLogicValue } from './seven-logic';
import { NarcissusDetector }     from './narcissus-detector';
import { MoiraTerminator }       from './moira-terminator';
import { getReiAIOSRuntime }     from '../aios/rei-aios-runtime-bus';

// ── 型定義 ────────────────────────────────────────────────

export interface OriginNode {
  id: string;
  label: string;
  conditions: string[];          // このノードが存在するための条件ノードID
  logicValue: SevenLogicValue;
  phi: number;                   // 情報統合量（IIT: 0〜1）
}

export interface OriginationResult {
  nodeId: string;
  canArise: boolean;             // 縁起として生起できるか
  logicValue: SevenLogicValue;
  reason: string;
  dependencyDepth: number;       // 依存の深さ
  circularDeps: string[][];      // 循環依存のパス
}

export interface OriginationMap {
  nodes: OriginNode[];
  totalNodes: number;
  arisingCount: number;          // 生起できているノード数
  overallHealth: SevenLogicValue;
  summary: string;
}

// ── DependentOrigination ──────────────────────────────────

export class DependentOrigination {
  private nodes: Map<string, OriginNode> = new Map();
  private narcissus: NarcissusDetector;
  private moira: MoiraTerminator;

  constructor() {
    this.narcissus = new NarcissusDetector();
    this.moira     = new MoiraTerminator();
  }

  // ── ノード登録 ───────────────────────────────────────

  addNode(node: OriginNode): void {
    this.nodes.set(node.id, node);
  }

  addAxiomNode(id: string, label: string, dependsOn: string[]): void {
    this.addNode({
      id,
      label,
      conditions: dependsOn,
      logicValue: 'FLOWING',
      phi: 0.5,
    });
  }

  // ── 生起判定 ─────────────────────────────────────────

  canArise(nodeId: string, visited: Set<string> = new Set()): OriginationResult {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return {
        nodeId,
        canArise: false,
        logicValue: 'ZERO',
        reason: `ノード "${nodeId}" が存在しない → ZERO（未問の潜在真理）`,
        dependencyDepth: 0,
        circularDeps: [],
      };
    }

    // 条件なし → 独立自性 → NagarjunaProofの結論により FALSE
    if (node.conditions.length === 0) {
      return {
        nodeId,
        canArise: false,
        logicValue: 'FALSE',
        reason: `条件なし = 独立自性 → 四不生により不成立（FALSE）`,
        dependencyDepth: 0,
        circularDeps: [],
      };
    }

    // 循環依存チェック
    if (visited.has(nodeId)) {
      // 循環依存は縁起の特殊形態（BOTH: 許容）
      // ただし NarcissusDetector で INFINITY になる場合は阻止
      this.narcissus.observe(nodeId, 'BOTH', [nodeId]);
      const report = this.narcissus.analyze();
      if (report.riskLevel === 'INFINITY') {
        return {
          nodeId,
          canArise: false,
          logicValue: 'INFINITY',
          reason: `無限循環依存 → INFINITY（収束しないため阻止）`,
          dependencyDepth: visited.size,
          circularDeps: [[...visited, nodeId]],
        };
      }
      return {
        nodeId,
        canArise: true,
        logicValue: 'BOTH',
        reason: `循環依存 = 縁起の特殊形態 → BOTH（許容）`,
        dependencyDepth: visited.size,
        circularDeps: [[...visited, nodeId]],
      };
    }

    visited.add(nodeId);

    // 全条件ノードを再帰チェック
    const condResults = node.conditions.map(cid => this.canArise(cid, new Set(visited)));
    const allArise = condResults.every(r => r.canArise);
    const anyInfinity = condResults.some(r => r.logicValue === 'INFINITY');
    const anyZero = condResults.some(r => r.logicValue === 'ZERO');

    if (anyInfinity) {
      return {
        nodeId,
        canArise: false,
        logicValue: 'INFINITY',
        reason: `依存先に無限連鎖あり → 縁起不成立`,
        dependencyDepth: visited.size,
        circularDeps: condResults.flatMap(r => r.circularDeps),
      };
    }

    if (anyZero) {
      return {
        nodeId,
        canArise: false,
        logicValue: 'ZERO',
        reason: `依存先に存在しないノードあり → ZERO`,
        dependencyDepth: visited.size,
        circularDeps: [],
      };
    }

    const logicValue: SevenLogicValue = allArise ? 'TRUE' : 'FLOWING';

    // RuntimeBus に space_snapshot として発火
    try {
      const bus = getReiAIOSRuntime();
      bus.publish({
        type: 'space_snapshot',
        payload: {
          spaceName: `origination:${nodeId}`,
          overallTag: logicValue,
          phi: node.phi,
          dimensions: node.conditions.map((cid, i) => ({
            name: cid,
            value: condResults[i].canArise ? 1.0 : 0.0,
            logicTag: condResults[i].logicValue,
          })),
        },
        source: 'DependentOrigination',
        timestamp: Date.now(),
      });
    } catch { /* RuntimeBus未接続時は無視 */ }

    return {
      nodeId,
      canArise: allArise,
      logicValue,
      reason: allArise
        ? `全依存条件成立 → 縁起として生起 (TRUE)`
        : `依存条件の一部がFLOWING → 生起過程中 (FLOWING)`,
      dependencyDepth: visited.size,
      circularDeps: condResults.flatMap(r => r.circularDeps),
    };
  }

  mapAll(): OriginationMap {
    const results = [...this.nodes.keys()].map(id => this.canArise(id));
    const arisingCount = results.filter(r => r.canArise).length;
    const total = results.length;

    const ratio = total > 0 ? arisingCount / total : 0;
    const overallHealth: SevenLogicValue =
      ratio >= 1.0 ? 'TRUE'    :
      ratio >= 0.7 ? 'FLOWING' :
      ratio >= 0.3 ? 'NEITHER' : 'ZERO';

    return {
      nodes: [...this.nodes.values()],
      totalNodes: total,
      arisingCount,
      overallHealth,
      summary:
        `${total}ノード中 ${arisingCount}ノードが縁起として生起 ` +
        `(${(ratio * 100).toFixed(1)}%) → ${overallHealth}`,
    };
  }
}
