/**
 * CausalChainEngine — 因果推論の強化エンジン
 *
 * DependentOrigination（既存）を拡張し、
 * 縁起の連鎖推論（A→B→C→...）を七価論理でマッピングする。
 *
 * 機能:
 *   1. 因果チェーン構築 — ノード間の有向因果関係
 *   2. 七価論理による因果強度評価
 *   3. 逆因果推論（結果→原因の遡及）
 *   4. 十二縁起（pratītyasamutpāda）の形式モデル
 *   5. DependentOrigination との統合
 *
 * Theory #105: 因果連鎖公理（CausalChain）
 * Theory #106: 逆因果遡及公理（ReverseCausation）
 */

import { type SevenLogicValue, and } from './seven-logic';
import { DependentOrigination } from './dependent-origination';
import type { SeedTheory } from './seed-kernel';

// ── 型定義 ─────────────────────────────────────────────

export interface CausalLink {
  from:      string;
  to:        string;
  strength:  SevenLogicValue;   // 因果の強さ（七価）
  label:     string;            // 因果関係の説明
}

export interface CausalNode {
  id:        string;
  label:     string;
  value:     SevenLogicValue;   // ノードの現在の論理値
}

export interface CausalChainResult {
  chain:         CausalNode[];
  links:         CausalLink[];
  overallStrength: SevenLogicValue;  // チェーン全体の因果強度
  depth:         number;
  isCircular:    boolean;           // 循環因果か
  explanation:   string;
}

export interface ReverseTraceResult {
  targetId:      string;
  causes:        CausalNode[];      // 遡及した原因ノード
  traceDepth:    number;
  rootCauses:    string[];          // 根本原因のID
  explanation:   string;
}

// ── 十二縁起の定義 ──────────────────────────────────────

const TWELVE_LINKS: { id: string; label: string; labelSanskrit: string }[] = [
  { id: 'avidya',       label: '無明',   labelSanskrit: 'avidyā' },
  { id: 'samskara',     label: '行',     labelSanskrit: 'saṃskāra' },
  { id: 'vijnana',      label: '識',     labelSanskrit: 'vijñāna' },
  { id: 'namarupa',     label: '名色',   labelSanskrit: 'nāmarūpa' },
  { id: 'sadayatana',   label: '六処',   labelSanskrit: 'ṣaḍāyatana' },
  { id: 'sparsha',      label: '触',     labelSanskrit: 'sparśa' },
  { id: 'vedana',       label: '受',     labelSanskrit: 'vedanā' },
  { id: 'trishna',      label: '愛',     labelSanskrit: 'tṛṣṇā' },
  { id: 'upadana',      label: '取',     labelSanskrit: 'upādāna' },
  { id: 'bhava',        label: '有',     labelSanskrit: 'bhava' },
  { id: 'jati',         label: '生',     labelSanskrit: 'jāti' },
  { id: 'jaramarana',   label: '老死',   labelSanskrit: 'jarāmaraṇa' },
];

// ── CausalChainEngine ──────────────────────────────────

export class CausalChainEngine {
  private nodes: Map<string, CausalNode> = new Map();
  private links: CausalLink[] = [];

  /**
   * ノードを追加する
   */
  addNode(id: string, label: string, value: SevenLogicValue = 'FLOWING'): void {
    this.nodes.set(id, { id, label, value });
  }

  /**
   * 因果リンクを追加する
   */
  addLink(from: string, to: string, strength: SevenLogicValue, label = ''): void {
    this.links.push({ from, to, strength, label });
  }

  /**
   * ノードの現在値を更新する
   */
  updateNode(id: string, value: SevenLogicValue): boolean {
    const node = this.nodes.get(id);
    if (!node) return false;
    node.value = value;
    return true;
  }

  /**
   * 因果チェーンを前方にトレースする（原因→結果）
   */
  traceForward(startId: string, maxDepth = 20): CausalChainResult {
    const chain: CausalNode[] = [];
    const chainLinks: CausalLink[] = [];
    const visited = new Set<string>();
    let isCircular = false;
    let currentId = startId;

    for (let depth = 0; depth < maxDepth; depth++) {
      if (visited.has(currentId)) {
        isCircular = true;
        break;
      }
      visited.add(currentId);

      const node = this.nodes.get(currentId);
      if (!node) break;
      chain.push(node);

      // 次のリンクを探す
      const outLinks = this.links.filter(l => l.from === currentId);
      if (outLinks.length === 0) break;

      // 最も強い因果リンクを選択
      const bestLink = outLinks.reduce((best, link) => {
        return this.strengthScore(link.strength) > this.strengthScore(best.strength) ? link : best;
      });
      chainLinks.push(bestLink);
      currentId = bestLink.to;
    }

    // 全体の因果強度 = 各リンクのAND合成
    let overallStrength: SevenLogicValue = chainLinks.length > 0 ? chainLinks[0].strength : 'ZERO';
    for (let i = 1; i < chainLinks.length; i++) {
      overallStrength = and(overallStrength, chainLinks[i].strength);
    }

    return {
      chain,
      links: chainLinks,
      overallStrength,
      depth: chain.length,
      isCircular,
      explanation: this.buildForwardExplanation(chain, chainLinks, overallStrength, isCircular),
    };
  }

  /**
   * 逆因果推論（結果→原因の遡及）
   */
  traceReverse(targetId: string, maxDepth = 20): ReverseTraceResult {
    const causes: CausalNode[] = [];
    const visited = new Set<string>();
    const rootCauses: string[] = [];

    const traverse = (nodeId: string, depth: number) => {
      if (depth >= maxDepth || visited.has(nodeId)) return;
      visited.add(nodeId);

      const node = this.nodes.get(nodeId);
      if (!node) return;
      causes.push(node);

      const inLinks = this.links.filter(l => l.to === nodeId);
      if (inLinks.length === 0) {
        rootCauses.push(nodeId);
        return;
      }

      for (const link of inLinks) {
        traverse(link.from, depth + 1);
      }
    };

    traverse(targetId, 0);

    return {
      targetId,
      causes,
      traceDepth: causes.length,
      rootCauses,
      explanation: `「${targetId}」の根本原因: ${rootCauses.join(', ') || '循環（根本原因なし）'}。` +
        `遡及深度: ${causes.length}ノード。`,
    };
  }

  /**
   * 十二縁起モデルを構築する
   */
  buildTwelveLinks(): CausalChainResult {
    // 十二縁起のノードを追加
    for (const link of TWELVE_LINKS) {
      this.addNode(link.id, `${link.label}（${link.labelSanskrit}）`, 'FLOWING');
    }

    // 順方向の因果リンク: 無明→行→識→...→老死
    for (let i = 0; i < TWELVE_LINKS.length - 1; i++) {
      this.addLink(
        TWELVE_LINKS[i].id,
        TWELVE_LINKS[i + 1].id,
        'FLOWING',
        `${TWELVE_LINKS[i].label}→${TWELVE_LINKS[i + 1].label}`,
      );
    }

    // 循環: 老死→無明（輪廻）
    this.addLink(
      TWELVE_LINKS[TWELVE_LINKS.length - 1].id,
      TWELVE_LINKS[0].id,
      'BOTH',
      '老死→無明（輪廻の循環）',
    );

    return this.traceForward('avidya', 13);
  }

  /**
   * DependentOrigination との統合
   * CausalChainEngine のノードを DependentOrigination に変換する
   */
  toDependentOrigination(): DependentOrigination {
    const depOrig = new DependentOrigination();
    for (const [id, node] of this.nodes) {
      const inLinks = this.links.filter(l => l.to === id);
      depOrig.addAxiomNode(id, node.label, inLinks.map(l => l.from));
    }
    return depOrig;
  }

  /**
   * 統計情報
   */
  stats(): { nodeCount: number; linkCount: number; circularCount: number } {
    // 循環の検出
    let circularCount = 0;
    for (const [id] of this.nodes) {
      const result = this.traceForward(id, 30);
      if (result.isCircular) circularCount++;
    }
    return {
      nodeCount: this.nodes.size,
      linkCount: this.links.length,
      circularCount,
    };
  }

  /**
   * SEED_KERNEL用の理論エントリ
   */
  static getSeedKernelEntries(): SeedTheory[] {
    return [
      {
        id: 'dfumt-causal-chain',
        axiom: 'CausalChain: A→B→C...の因果連鎖を七価論理でAND合成評価',
        category: 'logic',
        keywords: ['因果', 'causal', '連鎖', '縁起'],
      },
      {
        id: 'dfumt-reverse-causation',
        axiom: 'ReverseCausation: 結果→原因の遡及で根本原因を特定',
        category: 'logic',
        keywords: ['逆因果', 'reverse', '根本原因', '遡及'],
      },
    ];
  }

  private strengthScore(v: SevenLogicValue): number {
    const scores: Record<SevenLogicValue, number> = {
      TRUE: 1.0, FLOWING: 0.7, BOTH: 0.5, NEITHER: 0.3,
      ZERO: 0.0, FALSE: -0.5, INFINITY: 0.8,
    };
    return scores[v];
  }

  private buildForwardExplanation(
    chain: CausalNode[],
    links: CausalLink[],
    overall: SevenLogicValue,
    isCircular: boolean,
  ): string {
    const path = chain.map(n => n.label).join(' → ');
    const lines = [
      `因果チェーン: ${path}`,
      `深度: ${chain.length}ノード`,
      `全体の因果強度: ${overall}`,
    ];
    if (isCircular) lines.push('循環因果を検出（縁起の特殊形態）');
    return lines.join('\n');
  }
}
