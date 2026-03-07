/**
 * AriadneTracer — 推論トレースの逆引き（アリアドネの糸）
 *
 * D-FUMT Theory #76: アリアドネ逆引き理論
 * 「推論の迷宮を脱出するには、
 *  起点からの糸（トレース）を逆に辿ればよい」
 *
 * ExplainabilityEngine の AxiomChain を拡張し、
 *   前進（問い -> 結論）だけでなく
 *   逆引き（結論 -> 起点）を可能にする。
 *
 * 使用例:
 *   ContradictionDetector で BOTH が出た
 *   -> AriadneTracer で「どの推論ステップが矛盾を生んだか」を逆引き
 *   -> MoiraTerminator でそのステップを終了
 *   -> NarcissusDetector で再発防止
 */

import { type SevenLogicValue, toSymbol } from './seven-logic';
import { type AxiomChain } from './explainability-engine';

// ── スレッドノード（糸の一結び） ──
export interface ThreadNode {
  nodeId: string;
  axiomId: string;
  value: SevenLogicValue;
  parentId?: string;     // 前のノード（逆引き用）
  childIds: string[];    // 次のノード
  depth: number;
  label: string;
}

// ── 逆引き結果 ──
export interface BacktraceResult {
  found: boolean;
  path: ThreadNode[];        // 起点 -> 問題ノードの経路
  reversePath: ThreadNode[]; // 問題ノード -> 起点（糸を手繰る）
  originNode?: ThreadNode;   // 迷宮の起点
  problemNode?: ThreadNode;  // 問題が発生したノード
  explanation: string;       // 人間可読な説明
  thread: string;            // 糸の可視化（記号列）
}

// ── 迷宮の統計 ──
export interface LabyrinthStats {
  totalNodes: number;
  maxDepth: number;
  branchPoints: number;    // 分岐点の数
  deadEnds: number;        // 行き止まりの数
  criticalPath: string[];  // 最も重要な経路（axiomId[]）
}

export class AriadneTracer {
  private nodes: Map<string, ThreadNode> = new Map();
  private rootId?: string;
  private counter = 0;

  // ══════════════════════════════════════════════════════════════
  // 糸を張る: 推論ステップをトレースに追加
  // ══════════════════════════════════════════════════════════════

  /**
   * 新しいスレッドを開始する（迷宮に入る）
   */
  beginThread(rootAxiomId: string, rootValue: SevenLogicValue, label: string): string {
    const nodeId = `ariadne-${++this.counter}`;
    const node: ThreadNode = {
      nodeId, axiomId: rootAxiomId, value: rootValue,
      childIds: [], depth: 0, label,
    };
    this.nodes.set(nodeId, node);
    this.rootId = nodeId;
    return nodeId;
  }

  /**
   * 推論ステップを追加する（糸を伸ばす）
   */
  extend(
    parentId: string,
    axiomId: string,
    value: SevenLogicValue,
    label: string,
  ): string {
    const parent = this.nodes.get(parentId);
    if (!parent) throw new Error(`親ノードが見つかりません: ${parentId}`);

    const nodeId = `ariadne-${++this.counter}`;
    const node: ThreadNode = {
      nodeId, axiomId, value,
      parentId, childIds: [],
      depth: parent.depth + 1,
      label,
    };
    parent.childIds.push(nodeId);
    this.nodes.set(nodeId, node);
    return nodeId;
  }

  /**
   * ExplainabilityEngine の AxiomChain から
   * AriadneTracer のスレッドを自動構築する
   */
  fromChain(chain: AxiomChain): string {
    if (chain.steps.length === 0) return '';
    const first = chain.steps[0];
    let currentId = this.beginThread(
      first.axiomId, first.inputValue, chain.question,
    );
    for (const step of chain.steps) {
      currentId = this.extend(
        currentId, step.axiomId, step.outputValue, step.operation,
      );
    }
    return currentId;
  }

  // ══════════════════════════════════════════════════════════════
  // 糸を辿る: 逆引き（アリアドネの糸を手繰る）
  // ══════════════════════════════════════════════════════════════

  /**
   * 問題ノードから起点へ逆引きする
   * 「どこで迷子になったか」を特定する
   */
  backtrace(problemNodeId: string): BacktraceResult {
    const problemNode = this.nodes.get(problemNodeId);
    if (!problemNode) {
      return {
        found: false, path: [], reversePath: [],
        explanation: `ノードが見つかりません: ${problemNodeId}`,
        thread: '?',
      };
    }

    // 逆向きに辿る（問題ノード -> 起点）
    const reversePath: ThreadNode[] = [problemNode];
    let current = problemNode;
    while (current.parentId) {
      const parent = this.nodes.get(current.parentId);
      if (!parent) break;
      reversePath.push(parent);
      current = parent;
    }

    const originNode = reversePath[reversePath.length - 1];
    const forwardPath = [...reversePath].reverse();

    // 糸の可視化
    const thread = forwardPath
      .map(n => `${toSymbol(n.value)}[${n.axiomId.slice(0, 12)}]`)
      .join(' -> ');

    // 問題の特定
    const problematicStep = forwardPath.find(
      n => n.value === 'BOTH' || n.value === 'NEITHER' || n.value === 'INFINITY',
    );

    const explanation = problematicStep
      ? `問題発生: 深さ${problematicStep.depth}の「${problematicStep.axiomId}」で` +
        `${problematicStep.value}状態が発生。\n` +
        `起点「${originNode.label}」から${reversePath.length - 1}ステップ目。`
      : `正常な推論経路（${forwardPath.length}ステップ）。起点: 「${originNode.label}」`;

    return {
      found: true,
      path: forwardPath,
      reversePath,
      originNode,
      problemNode,
      explanation,
      thread,
    };
  }

  /**
   * 全ノードを逆引きして、問題の根本原因を特定する
   * （迷宮全体のマッピング）
   */
  findRootCause(): BacktraceResult | null {
    // BOTH / INFINITY / NEITHER のノードを探す
    const problematic = [...this.nodes.values()].filter(
      n => n.value === 'BOTH' || n.value === 'INFINITY' || n.value === 'NEITHER',
    );
    if (problematic.length === 0) return null;

    // 最も深いものを根本原因として逆引き
    const deepest = problematic.sort((a, b) => b.depth - a.depth)[0];
    return this.backtrace(deepest.nodeId);
  }

  /**
   * 迷宮の統計情報を返す
   */
  labyrinthStats(): LabyrinthStats {
    const allNodes = [...this.nodes.values()];
    const maxDepth = Math.max(...allNodes.map(n => n.depth), 0);
    const branchPoints = allNodes.filter(n => n.childIds.length > 1).length;
    const deadEnds = allNodes.filter(n => n.childIds.length === 0).length;

    // クリティカルパス（起点から最深ノードまで）
    const deepestNode = allNodes.sort((a, b) => b.depth - a.depth)[0];
    const criticalPath: string[] = [];
    if (deepestNode) {
      const result = this.backtrace(deepestNode.nodeId);
      result.path.forEach(n => criticalPath.push(n.axiomId));
    }

    return { totalNodes: allNodes.length, maxDepth, branchPoints, deadEnds, criticalPath };
  }

  reset(): void {
    this.nodes.clear();
    this.rootId = undefined;
    this.counter = 0;
  }
}
