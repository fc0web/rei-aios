/**
 * AxiomRCT — Rei Compression Theory（D-FUMT Theory #67）
 *
 * 縁起的関係網に基づく公理圧縮。
 * 公理集合を重み付きグラフとして表現し、
 * 最小全域木順でエンコードすることで
 * 意味的に近い公理を連続配置してデルタ圧縮効率を最大化する。
 *
 * RCT公理: RCT(A) = SpanningTree(Endo(A)) → DeltaStream(A)
 *   Endo(A): 縁起グラフ（公理間の意味的距離）
 *   SpanningTree: Prim法による最小全域木
 *   DeltaStream: 木順トラバーサルによるデルタ列
 */

import * as zlib from 'zlib';
import { createHash } from 'crypto';
import type { SeedTheory } from './seed-kernel';

// ─── グラフ構造 ──────────────────────────────────────────

/** 縁起グラフのエッジ（公理間の意味的近接度） */
export interface EndoEdge {
  from: number;   // 公理インデックス
  to: number;
  weight: number; // 近接度（大きいほど近い）
}

/** 最小全域木のノード */
export interface SpanTreeNode {
  index: number;      // 元の公理インデックス
  parentIndex: number; // 親ノードのインデックス（-1 = root）
  depth: number;
}

// ─── 圧縮形式 ────────────────────────────────────────────

/** RCTエントリ（木順デルタエンコード済み） */
export interface RCTEntry {
  type: 'root' | 'child';
  id: string;
  // root: フル保存
  axiom?: string;
  category?: string;
  keywords?: string[];
  // child: 親との差分のみ
  parentId?: string;
  sharedKeywords?: string[];   // 親と共通（省略）
  uniqueKeywords?: string[];   // このノード固有
  axiomDelta?: string;         // axiomの変化分（共通プレフィクスを除く）
  axiomPrefix?: number;        // 親のaxiomと共通するプレフィクス文字数
  categoryChanged?: boolean;
  newCategory?: string;
}

/** RCT圧縮結果 */
export interface RCTResult {
  data: Buffer;
  originalSize: number;
  compressedSize: number;
  ratio: number;
  graphEdges: number;       // 縁起グラフのエッジ数
  treeDepthAvg: number;     // 平均木の深さ
  rctScore: number;         // RCTスコア（意味保持率 × 圧縮率）
}

// ─── AxiomRCT 本体 ────────────────────────────────────────

export class AxiomRCT {

  /**
   * 縁起グラフを構築（公理間の意味的近接度を計算）
   * 近接度 = 共通キーワード数 × 2 + カテゴリ一致 × 3
   */
  buildEndoGraph(axioms: SeedTheory[]): EndoEdge[] {
    const edges: EndoEdge[] = [];
    for (let i = 0; i < axioms.length; i++) {
      for (let j = i + 1; j < axioms.length; j++) {
        const weight = this.computeProximity(axioms[i], axioms[j]);
        if (weight > 0) {
          edges.push({ from: i, to: j, weight });
        }
      }
    }
    return edges;
  }

  /** 2公理の意味的近接度を計算 */
  computeProximity(a: SeedTheory, b: SeedTheory): number {
    // 共通キーワード数
    const kwA = new Set(a.keywords);
    const sharedKw = b.keywords.filter(k => kwA.has(k)).length;
    // カテゴリ一致
    const catMatch = a.category === b.category ? 3 : 0;
    // axiomの共通プレフィクス長（正規化）
    let prefixLen = 0;
    const minLen = Math.min(a.axiom.length, b.axiom.length);
    while (prefixLen < minLen && a.axiom[prefixLen] === b.axiom[prefixLen]) {
      prefixLen++;
    }
    const prefixScore = prefixLen >= 3 ? 1 : 0;
    return sharedKw * 2 + catMatch + prefixScore;
  }

  /**
   * Prim法で最小全域木を構築（重みが最大のエッジを優先 = 意味的に近い公理を繋ぐ）
   */
  buildSpanningTree(axioms: SeedTheory[], edges: EndoEdge[]): SpanTreeNode[] {
    if (axioms.length === 0) return [];
    if (axioms.length === 1) return [{ index: 0, parentIndex: -1, depth: 0 }];

    // 隣接リスト構築
    const adj = new Array<Array<{ to: number; weight: number }>>(axioms.length)
      .fill(null as any).map(() => []);
    for (const e of edges) {
      adj[e.from].push({ to: e.to, weight: e.weight });
      adj[e.to].push({ to: e.from, weight: e.weight });
    }

    // Prim法（最大重み優先 = 意味的に近いものを優先連結）
    const inTree = new Array(axioms.length).fill(false);
    const parent = new Array(axioms.length).fill(-1);
    const depth = new Array(axioms.length).fill(0);
    const maxWeight = new Array(axioms.length).fill(-1);

    inTree[0] = true;
    maxWeight[0] = Infinity;

    for (let step = 0; step < axioms.length - 1; step++) {
      // 木に入っていないノードで最大重みエッジを持つものを選択
      let bestNode = -1;
      let bestWeight = -1;
      for (let i = 0; i < axioms.length; i++) {
        if (!inTree[i] && maxWeight[i] > bestWeight) {
          bestWeight = maxWeight[i];
          bestNode = i;
        }
      }
      if (bestNode === -1) {
        // 孤立ノード: 木に強制接続（rootの子として）
        for (let i = 0; i < axioms.length; i++) {
          if (!inTree[i]) { bestNode = i; parent[i] = 0; depth[i] = 1; break; }
        }
      }
      if (bestNode === -1) break;
      inTree[bestNode] = true;
      depth[bestNode] = parent[bestNode] === -1 ? 0 : depth[parent[bestNode]] + 1;

      // 隣接ノードの重みを更新
      for (const { to, weight } of adj[bestNode]) {
        if (!inTree[to] && weight > maxWeight[to]) {
          maxWeight[to] = weight;
          parent[to] = bestNode;
        }
      }
    }

    return axioms.map((_, i) => ({
      index: i,
      parentIndex: parent[i],
      depth: parent[i] === -1 ? 0 : depth[parent[i]] + 1,
    }));
  }

  /**
   * 木の幅優先トラバーサル順で公理を並べ替え（縁起順）
   */
  traverseTree(axioms: SeedTheory[], tree: SpanTreeNode[]): SeedTheory[] {
    // 子ノードリストを構築
    const children = new Array<number[]>(axioms.length).fill(null as any).map(() => []);
    let root = 0;
    for (const node of tree) {
      if (node.parentIndex === -1) root = node.index;
      else children[node.parentIndex].push(node.index);
    }

    // BFSトラバーサル
    const order: number[] = [];
    const queue = [root];
    while (queue.length > 0) {
      const current = queue.shift()!;
      order.push(current);
      for (const child of children[current]) queue.push(child);
    }

    // 未訪問ノードを末尾に追加（孤立ノード対応）
    const visited = new Set(order);
    for (let i = 0; i < axioms.length; i++) {
      if (!visited.has(i)) order.push(i);
    }

    return order.map(i => axioms[i]);
  }

  /**
   * 縁起順に並んだ公理列をRCTエントリにエンコード
   */
  encodeRCT(ordered: SeedTheory[], tree: SpanTreeNode[], originalOrder: SeedTheory[]): RCTEntry[] {
    const entries: RCTEntry[] = [];
    const idToAxiom = new Map<string, SeedTheory>();
    for (const a of originalOrder) idToAxiom.set(a.id, a);

    // 親マップ（ID → 親ID）を縁起順に再構築
    const parentMap = new Map<string, string | null>();
    parentMap.set(ordered[0].id, null);
    for (let i = 1; i < ordered.length; i++) {
      // 直前の公理を「親」とみなす（木順なので意味的に近い）
      parentMap.set(ordered[i].id, ordered[i - 1].id);
    }

    for (let i = 0; i < ordered.length; i++) {
      const curr = ordered[i];
      const parentId = parentMap.get(curr.id) ?? null;

      if (parentId === null || i === 0) {
        // Root: フル保存
        entries.push({
          type: 'root',
          id: curr.id,
          axiom: curr.axiom,
          category: curr.category,
          keywords: curr.keywords,
        });
      } else {
        const parent = idToAxiom.get(parentId) ?? ordered[i - 1];
        // 共通キーワードを省略
        const parentKwSet = new Set(parent.keywords);
        const sharedKeywords = curr.keywords.filter(k => parentKwSet.has(k));
        const uniqueKeywords = curr.keywords.filter(k => !parentKwSet.has(k));

        // axiomの共通プレフィクス
        let prefixLen = 0;
        const minLen = Math.min(curr.axiom.length, parent.axiom.length);
        while (prefixLen < minLen && curr.axiom[prefixLen] === parent.axiom[prefixLen]) {
          prefixLen++;
        }
        const axiomDelta = curr.axiom.slice(prefixLen);
        const categoryChanged = curr.category !== parent.category;

        entries.push({
          type: 'child',
          id: curr.id,
          parentId,
          sharedKeywords: sharedKeywords.length > 0 ? sharedKeywords : undefined,
          uniqueKeywords: uniqueKeywords.length > 0 ? uniqueKeywords : undefined,
          axiomDelta: axiomDelta || undefined,
          axiomPrefix: prefixLen > 0 ? prefixLen : undefined,
          categoryChanged: categoryChanged || undefined,
          newCategory: categoryChanged ? curr.category : undefined,
        });
      }
    }
    return entries;
  }

  /** RCTエントリから公理を復元 */
  decodeRCT(entries: RCTEntry[]): SeedTheory[] {
    const axioms: SeedTheory[] = [];
    const idToAxiom = new Map<string, SeedTheory>();

    for (const entry of entries) {
      if (entry.type === 'root') {
        const axiom: SeedTheory = {
          id: entry.id,
          axiom: entry.axiom!,
          category: entry.category!,
          keywords: entry.keywords!,
        };
        axioms.push(axiom);
        idToAxiom.set(axiom.id, axiom);
      } else {
        const parent = entry.parentId ? idToAxiom.get(entry.parentId) : null;
        const prevAxiom = parent ?? (axioms.length > 0 ? axioms[axioms.length - 1] : null);

        // axiomを復元
        const prefix = prevAxiom && entry.axiomPrefix
          ? prevAxiom.axiom.slice(0, entry.axiomPrefix)
          : '';
        const axiomStr = prefix + (entry.axiomDelta ?? '');

        // カテゴリを復元
        const category = entry.categoryChanged
          ? entry.newCategory!
          : (prevAxiom?.category ?? 'general');

        // キーワードを復元（共通＋固有）
        const keywords = [
          ...(entry.sharedKeywords ?? []),
          ...(entry.uniqueKeywords ?? []),
        ];

        const axiom: SeedTheory = { id: entry.id, axiom: axiomStr, category, keywords };
        axioms.push(axiom);
        idToAxiom.set(axiom.id, axiom);
      }
    }
    return axioms;
  }

  /** 公理列をRCT圧縮 */
  compress(axioms: SeedTheory[]): RCTResult {
    if (axioms.length === 0) {
      const empty = Buffer.concat([Buffer.from('REI\x05'), zlib.gzipSync('{}')]);
      return { data: empty, originalSize: 0, compressedSize: empty.length, ratio: 1, graphEdges: 0, treeDepthAvg: 0, rctScore: 0 };
    }

    const originalSize = Buffer.byteLength(JSON.stringify(axioms), 'utf8');

    // Step 1: 縁起グラフ構築
    const edges = this.buildEndoGraph(axioms);

    // Step 2: 最小全域木（意味的近接順）
    const tree = this.buildSpanningTree(axioms, edges);

    // Step 3: 縁起順トラバーサル
    const ordered = this.traverseTree(axioms, tree);

    // Step 4: RCTエンコード
    const entries = this.encodeRCT(ordered, tree, axioms);

    // Step 5: gzip
    const payload = JSON.stringify({ entries });
    const compressed = zlib.gzipSync(Buffer.from(payload, 'utf8'), { level: 9 });
    const data = Buffer.concat([Buffer.from('REI\x05'), compressed]);

    // 木の深さ平均
    const depths = tree.map(n => n.depth);
    const treeDepthAvg = depths.reduce((a, b) => a + b, 0) / Math.max(depths.length, 1);

    // RCTスコア = 意味保持率（グラフエッジ数/最大可能エッジ数）× 圧縮効率
    const maxEdges = axioms.length * (axioms.length - 1) / 2;
    const semanticRetention = maxEdges > 0 ? Math.min(1, edges.length / Math.max(1, maxEdges * 0.3)) : 1;
    const compressionEfficiency = 1 - (data.length / originalSize);
    const rctScore = semanticRetention * Math.max(0, compressionEfficiency);

    return {
      data,
      originalSize,
      compressedSize: data.length,
      ratio: data.length / originalSize,
      graphEdges: edges.length,
      treeDepthAvg,
      rctScore,
    };
  }

  /** 復元 */
  decompress(data: Buffer): SeedTheory[] {
    const magic = data.subarray(0, 4).toString();
    if (magic !== 'REI\x05') throw new Error(`Invalid RCT format: ${magic}`);
    const payload = zlib.gunzipSync(data.subarray(4)).toString('utf8');
    const { entries } = JSON.parse(payload) as { entries: RCTEntry[] };
    return this.decodeRCT(entries);
  }

  /** RCT理論の説明文を生成 */
  describeTheory(): string {
    return [
      '=== D-FUMT Theory #67: Rei Compression Theory (RCT) ===',
      '',
      '公理: RCT(A) = SpanningTree(Endo(A)) → DeltaStream(A)',
      '',
      'Endo(A): 縁起グラフ（公理間の意味的近接度）',
      '  近接度 = 共通キーワード × 2 + カテゴリ一致 × 3 + 共通プレフィクス',
      '',
      'SpanningTree: Prim法による最大重み全域木',
      '  意味的に近い公理を連続配置することでデルタ圧縮効率を最大化',
      '',
      'DeltaStream: 縁起順トラバーサルによるデルタ列',
      '  root（最初の公理）: フル保存',
      '  child（残り）:  親との差分のみ保存',
      '',
      'コルモゴロフ複雑性との違い:',
      '  コルモゴロフ: 最短プログラム長 = 本質（到達不能）',
      '  RCT:         最短の縁起構造記述 = 本質（実装可能）',
    ].join('\n');
  }
}
