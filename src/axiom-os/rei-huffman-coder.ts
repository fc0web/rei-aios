/**
 * ReiHuffmanCoder — マヤ文字ハイブリッド符号体系
 *
 * D-FUMT Theory #68: マヤ符号理論
 * 「頻度×意味×音節の三層符号化が最小記述長を実現する」
 *
 * 三層構造:
 *   Layer 1 (表意): 公理カテゴリ → 固定短符号（1〜2bit）
 *   Layer 2 (表音): キーワード  → ハフマン符号（頻度適応）
 *   Layer 3 (音節): 残余文字列  → 標準符号
 *
 * マヤ対応:
 *   表意符号 = 概念を直接表すマヤグリフ（T-number）
 *   表音符号 = 音節を組み合わせるマヤ音節文字
 *   ハイブリッド = 状況によって使い分け（最短表現を選択）
 */

import { type SeedTheory } from './seed-kernel';
import { type SevenLogicValue } from './seven-logic';

// ── ハフマン木ノード ──
interface HuffmanNode {
  symbol: string;
  freq: number;
  left?: HuffmanNode;
  right?: HuffmanNode;
}

// ── 符号表エントリ ──
export interface CodeEntry {
  symbol: string;
  code: string;       // '0101...' ビット列
  layer: 1 | 2 | 3;  // マヤ三層のどれか
  bitLength: number;
}

// ── エンコード結果 ──
export interface HybridEncodeResult {
  original: string;
  encoded: string;           // ビット列（文字列表現）
  bitLength: number;
  compressionRatio: number;  // original.length*8 / bitLength
  layerBreakdown: {
    layer1Bits: number;  // 表意（カテゴリ）
    layer2Bits: number;  // 表音（キーワード）
    layer3Bits: number;  // 音節（残余）
  };
  logicTag: SevenLogicValue;
}

export class ReiHuffmanCoder {
  private freqTable: Map<string, number> = new Map();
  private codeTable: Map<string, CodeEntry> = new Map();
  private built = false;

  // ── カテゴリ固定符号（Layer 1 表意、2〜3bit） ──
  private readonly CATEGORY_CODES: Record<string, string> = {
    'logic':              '00',
    'mathematics':        '010',
    'computation':        '011',
    'consciousness':      '100',
    'eastern-philosophy': '101',
    'western-philosophy': '1100',
    'quantum':            '1101',
    'cosmic':             '1110',
    'general':            '1111',
  };

  /**
   * 学習: テキスト群から頻度表を構築する
   */
  train(texts: string[]): void {
    this.freqTable.clear();
    for (const text of texts) {
      const tokens = text.split(/[\s,。、「」()×→＝]+/).filter(Boolean);
      for (const token of tokens) {
        this.freqTable.set(token, (this.freqTable.get(token) ?? 0) + 1);
      }
    }
    this.buildHuffman();
    this.built = true;
  }

  /**
   * SEED_KERNELから自動学習（最もよく使う初期化方法）
   */
  trainFromSeedKernel(theories: SeedTheory[]): void {
    const texts = theories.flatMap(t => [
      t.axiom,
      ...t.keywords,
      t.category,
    ]);
    this.train(texts);
  }

  /**
   * エンコード: テキスト → ハイブリッド符号
   */
  encode(text: string, category?: string): HybridEncodeResult {
    if (!this.built) throw new Error('train() を先に呼んでください');

    let bits = '';
    let layer1 = 0, layer2 = 0, layer3 = 0;

    // Layer 1: カテゴリ符号
    if (category && this.CATEGORY_CODES[category]) {
      const catCode = this.CATEGORY_CODES[category];
      bits += catCode;
      layer1 += catCode.length;
    }

    // Layer 2 + 3: トークンのハフマン符号
    const tokens = text.split(/[\s,。、「」()×→＝]+/).filter(Boolean);
    for (const token of tokens) {
      const entry = this.codeTable.get(token);
      if (entry) {
        bits += entry.code;
        if (entry.layer === 2) layer2 += entry.bitLength;
        else layer3 += entry.bitLength;
      } else {
        // 未知トークン: UTF-8バイト列として Layer 3 に落とす
        const bytes = new TextEncoder().encode(token);
        for (const b of bytes) {
          const byteCode = b.toString(2).padStart(8, '0');
          bits += byteCode;
          layer3 += 8;
        }
      }
    }

    const originalBits = text.length * 8; // UTF-8近似
    const ratio = originalBits / Math.max(bits.length, 1);

    // 圧縮率から七価論理タグを決定
    const logicTag: SevenLogicValue =
      ratio > 3.0  ? 'INFINITY' :  // 非常に高圧縮
      ratio > 2.0  ? 'TRUE'     :  // 良好
      ratio > 1.0  ? 'FLOWING'  :  // まあまあ
      ratio > 0.8  ? 'NEITHER'  :  // ほぼ等価
                     'FALSE';      // 膨張

    return {
      original: text,
      encoded: bits,
      bitLength: bits.length,
      compressionRatio: ratio,
      layerBreakdown: { layer1Bits: layer1, layer2Bits: layer2, layer3Bits: layer3 },
      logicTag,
    };
  }

  /** 符号表を返す（デバッグ・検証用） */
  getCodeTable(): CodeEntry[] {
    return [...this.codeTable.values()].sort((a, b) => a.bitLength - b.bitLength);
  }

  // ── ハフマン木の構築 ──
  private buildHuffman(): void {
    this.codeTable.clear();

    // 優先度キュー（単純実装）
    const nodes: HuffmanNode[] = [...this.freqTable.entries()]
      .map(([symbol, freq]) => ({ symbol, freq }))
      .sort((a, b) => a.freq - b.freq);

    if (nodes.length === 0) return;
    if (nodes.length === 1) {
      this.codeTable.set(nodes[0].symbol, {
        symbol: nodes[0].symbol, code: '0', layer: 2, bitLength: 1,
      });
      return;
    }

    // ハフマン木構築
    while (nodes.length > 1) {
      nodes.sort((a, b) => a.freq - b.freq);
      const left = nodes.shift()!;
      const right = nodes.shift()!;
      nodes.push({ symbol: '', freq: left.freq + right.freq, left, right });
    }

    // 符号割り当て
    this.assignCodes(nodes[0], '');
  }

  private assignCodes(node: HuffmanNode, prefix: string): void {
    if (!node.left && !node.right) {
      // 高頻度（短い符号）= Layer 2、低頻度（長い符号）= Layer 3
      const layer: 2 | 3 = prefix.length <= 8 ? 2 : 3;
      this.codeTable.set(node.symbol, {
        symbol: node.symbol, code: prefix, layer, bitLength: prefix.length,
      });
      return;
    }
    if (node.left)  this.assignCodes(node.left,  prefix + '0');
    if (node.right) this.assignCodes(node.right, prefix + '1');
  }
}
