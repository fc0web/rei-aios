/**
 * AxiomCompressionSelector — 圧縮方式自動選択エンジン
 *
 * データの特性を分析して4方式から最適な圧縮を自動選択する。
 *
 * 選択基準:
 *   REI\x02 (Hybrid): 汎用。sourceフィールドが多い場合
 *   REI\x03 (Delta):  類似公理が多い場合（カテゴリ集中度が高い）
 *   REI\x04 (LLMZip): 繰り返しパターンが多い場合（予測しやすい）
 *   REI\x05 (RCT):    関係性が豊富な場合（グラフ密度が高い）
 */

import type { SeedTheory } from './seed-kernel';
import { HybridCompressor } from './hybrid-compressor';
import { AxiomDeltaCompressor } from './axiom-delta-compressor';
import { AxiomLLMZip } from './axiom-llm-zip';
import { AxiomRCT } from './axiom-rct';

export type CompressionMethod = 'hybrid' | 'delta' | 'llmzip' | 'rct' | 'auto';

export interface DataProfile {
  axiomCount: number;
  categoryDiversity: number;    // カテゴリ種類数 / 公理数（小さいほど集中）
  keywordOverlapRate: number;   // 共通キーワード率（大きいほど類似）
  axiomLengthVariance: number;  // axiom長さの分散（大きいほど多様）
  sourceFieldRate: number;      // sourceフィールドを持つ公理の割合
  repetitionScore: number;      // 繰り返しパターンスコア（0〜1）
}

export interface SelectionResult {
  method: CompressionMethod;
  reason: string;
  profile: DataProfile;
  data: Buffer;
  originalSize: number;
  compressedSize: number;
  ratio: number;
}

export interface BenchmarkResult {
  method: CompressionMethod;
  ratio: number;
  compressMs: number;
  decompressMs: number;
  valid: boolean; // ラウンドトリップ成功か
}

export class AxiomCompressionSelector {
  private hybrid = new HybridCompressor();
  private delta = new AxiomDeltaCompressor();
  private llmzip = new AxiomLLMZip();
  private rct = new AxiomRCT();

  /** データプロファイルを分析 */
  analyzeProfile(axioms: SeedTheory[]): DataProfile {
    if (axioms.length === 0) {
      return { axiomCount: 0, categoryDiversity: 1, keywordOverlapRate: 0, axiomLengthVariance: 0, sourceFieldRate: 0, repetitionScore: 0 };
    }

    // カテゴリ多様性
    const categories = new Set(axioms.map(a => a.category));
    const categoryDiversity = categories.size / axioms.length;

    // キーワード重複率
    const allKw = axioms.flatMap(a => a.keywords);
    const uniqueKw = new Set(allKw);
    const keywordOverlapRate = allKw.length > 0
      ? 1 - (uniqueKw.size / allKw.length)
      : 0;

    // axiom長さの分散
    const lengths = axioms.map(a => a.axiom.length);
    const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const axiomLengthVariance = lengths.reduce((sum, l) => sum + (l - avgLen) ** 2, 0) / lengths.length;

    // sourceフィールド率
    const sourceFieldRate = axioms.filter(a => (a as any).source?.length >= 20).length / axioms.length;

    // 繰り返しパターンスコア（カテゴリ連続出現率）
    let consecutive = 0;
    for (let i = 1; i < axioms.length; i++) {
      if (axioms[i].category === axioms[i - 1].category) consecutive++;
    }
    const repetitionScore = axioms.length > 1 ? consecutive / (axioms.length - 1) : 0;

    return {
      axiomCount: axioms.length,
      categoryDiversity,
      keywordOverlapRate,
      axiomLengthVariance,
      sourceFieldRate,
      repetitionScore,
    };
  }

  /** プロファイルから最適な方式を選択 */
  selectMethod(profile: DataProfile): { method: CompressionMethod; reason: string } {
    // sourceが多い → Hybrid（source辞書圧縮が効く）
    if (profile.sourceFieldRate > 0.5) {
      return { method: 'hybrid', reason: `sourceフィールド率${(profile.sourceFieldRate * 100).toFixed(0)}%が高い → Hybrid` };
    }

    // カテゴリが集中 + キーワード重複が多い → Delta（差分が小さくなる）
    if (profile.categoryDiversity < 0.15 && profile.keywordOverlapRate > 0.4) {
      return { method: 'delta', reason: `カテゴリ集中度高・キーワード重複率${(profile.keywordOverlapRate * 100).toFixed(0)}% → Delta` };
    }

    // 繰り返しパターンが多い → LLMZip（予測ヒット率が上がる）
    if (profile.repetitionScore > 0.5) {
      return { method: 'llmzip', reason: `繰り返しスコア${(profile.repetitionScore * 100).toFixed(0)}%が高い → LLMZip` };
    }

    // キーワード重複が多い（関係性豊富） → RCT（縁起グラフが密になる）
    if (profile.keywordOverlapRate > 0.3) {
      return { method: 'rct', reason: `キーワード重複率${(profile.keywordOverlapRate * 100).toFixed(0)}%が中程度 → RCT` };
    }

    // デフォルト: Hybrid
    return { method: 'hybrid', reason: '特徴なし → Hybrid（汎用）' };
  }

  /** 自動選択して圧縮 */
  compress(
    axioms: SeedTheory[],
    method: CompressionMethod = 'auto'
  ): SelectionResult {
    const profile = this.analyzeProfile(axioms);
    let selected = method;
    let reason = `手動選択: ${method}`;

    if (method === 'auto') {
      const sel = this.selectMethod(profile);
      selected = sel.method;
      reason = sel.reason;
    }

    let data: Buffer;
    let compressedSize: number;
    let originalSize = Buffer.byteLength(JSON.stringify(axioms), 'utf8');

    switch (selected) {
      case 'delta': {
        const result = this.delta.compress(axioms);
        data = result.data;
        compressedSize = result.compressedSize;
        break;
      }
      case 'llmzip': {
        const result = this.llmzip.compress(axioms);
        data = result.data;
        compressedSize = result.compressedSize;
        break;
      }
      case 'rct': {
        const result = this.rct.compress(axioms);
        data = result.data;
        compressedSize = result.compressedSize;
        break;
      }
      default: { // hybrid
        const result = this.hybrid.compress(axioms);
        data = this.hybrid.serialize(result);
        compressedSize = data.length;
        break;
      }
    }

    return {
      method: selected,
      reason,
      profile,
      data,
      originalSize,
      compressedSize,
      ratio: originalSize > 0 ? compressedSize / originalSize : 1,
    };
  }

  /** 復元（マジックバイトから方式を自動判定） */
  decompress(data: Buffer): SeedTheory[] {
    const magic = data.subarray(0, 4).toString();
    switch (magic) {
      case 'REI\x02': return this.hybrid.deserialize(data);
      case 'REI\x03': return this.delta.decompress(data);
      case 'REI\x04': return this.llmzip.decompress(data);
      case 'REI\x05': return this.rct.decompress(data);
      default: throw new Error(`Unknown compression format: ${JSON.stringify(magic)}`);
    }
  }

  /** 全方式をベンチマークして比較 */
  benchmark(axioms: SeedTheory[]): BenchmarkResult[] {
    const methods: CompressionMethod[] = ['hybrid', 'delta', 'llmzip', 'rct'];
    const results: BenchmarkResult[] = [];

    for (const method of methods) {
      try {
        const t0 = Date.now();
        const result = this.compress(axioms, method);
        const compressMs = Date.now() - t0;

        const t1 = Date.now();
        const restored = this.decompress(result.data);
        const decompressMs = Date.now() - t1;

        // ラウンドトリップ検証
        const valid = restored.length === axioms.length &&
          axioms.every((a, i) => restored.find(r => r.id === a.id) !== undefined);

        results.push({ method, ratio: result.ratio, compressMs, decompressMs, valid });
      } catch (e) {
        results.push({ method, ratio: 1, compressMs: 0, decompressMs: 0, valid: false });
      }
    }

    return results.sort((a, b) => a.ratio - b.ratio);
  }

  /** ベンチマーク結果を表示文字列に変換 */
  formatBenchmark(results: BenchmarkResult[]): string {
    const lines = ['方式       圧縮率   圧縮ms  復元ms  有効'];
    for (const r of results) {
      lines.push(
        `${r.method.padEnd(10)} ${(r.ratio * 100).toFixed(1).padStart(6)}%  ${String(r.compressMs).padStart(5)}ms  ${String(r.decompressMs).padStart(5)}ms  ${r.valid ? '✓' : '✗'}`
      );
    }
    return lines.join('\n');
  }
}
