import { createHash } from 'crypto';
import { CodeAxiomExtractor, type ExtractionResult } from './code-axiom-extractor';
import type { SeedTheory } from './seed-kernel';

/** チャンク分割の設定 */
export interface ChunkConfig {
  chunkSize: number;       // 1チャンクあたりの文字数（デフォルト: 2000）
  overlap: number;         // チャンク間のオーバーラップ文字数（デフォルト: 200）
  maxChunks: number;       // 最大チャンク数（デフォルト: 50）
  deduplicateIds: boolean; // ID重複を除去するか（デフォルト: true）
}

/** チャンク処理の結果 */
export interface ChunkResult {
  chunkIndex: number;
  chunkHash: string;       // SHA-256(チャンク内容)
  startOffset: number;
  endOffset: number;
  axioms: SeedTheory[];
  processingMs: number;
}

/** 並列抽出の最終結果 */
export interface ParallelExtractionResult {
  totalChunks: number;
  totalAxioms: number;
  uniqueAxioms: number;     // 重複除去後
  duplicatesRemoved: number;
  chunkResults: ChunkResult[];
  mergedAxioms: SeedTheory[];
  totalMs: number;
  compressionHint: number;  // 推定圧縮率
}

export class AxiomChunkExtractor {
  private config: Required<ChunkConfig>;
  private extractor: CodeAxiomExtractor;

  constructor(config: Partial<ChunkConfig> = {}) {
    this.config = {
      chunkSize: config.chunkSize ?? 2000,
      overlap: config.overlap ?? 200,
      maxChunks: config.maxChunks ?? 50,
      deduplicateIds: config.deduplicateIds ?? true,
    };
    this.extractor = new CodeAxiomExtractor();
  }

  /** ソースコードをチャンクに分割 */
  splitIntoChunks(source: string): Array<{ text: string; start: number; end: number }> {
    const chunks: Array<{ text: string; start: number; end: number }> = [];
    const { chunkSize, overlap, maxChunks } = this.config;

    let start = 0;
    while (start < source.length && chunks.length < maxChunks) {
      // 行境界で分割（コードの途中で切らない）
      let end = Math.min(start + chunkSize, source.length);
      if (end < source.length) {
        const nextNewline = source.indexOf('\n', end);
        if (nextNewline !== -1 && nextNewline - end < 200) {
          end = nextNewline + 1;
        }
      }
      chunks.push({ text: source.slice(start, end), start, end });
      // オーバーラップを考慮して次のチャンク開始位置を決定
      start = end - overlap;
      if (start >= source.length) break;
    }
    return chunks;
  }

  /** 単一チャンクの公理抽出 */
  extractChunk(chunk: { text: string; start: number; end: number }, index: number): ChunkResult {
    const t0 = Date.now();
    const chunkHash = createHash('sha256').update(chunk.text).digest('hex').slice(0, 16);

    let axioms: SeedTheory[] = [];
    try {
      const result = this.extractor.extract(chunk.text);
      axioms = result.seedTheories;
    } catch {
      // チャンク抽出失敗時は空リストを返す（全体を止めない）
      axioms = [];
    }

    return {
      chunkIndex: index,
      chunkHash,
      startOffset: chunk.start,
      endOffset: chunk.end,
      axioms,
      processingMs: Date.now() - t0,
    };
  }

  /** 全チャンクを順次処理して結果をマージ（Node.jsはシングルスレッドのため疑似並列） */
  extract(source: string): ParallelExtractionResult {
    const t0 = Date.now();
    const chunks = this.splitIntoChunks(source);

    // 各チャンクを処理
    const chunkResults: ChunkResult[] = chunks.map((chunk, i) =>
      this.extractChunk(chunk, i)
    );

    // 全公理をマージ
    const allAxioms: SeedTheory[] = chunkResults.flatMap(r => r.axioms);
    const totalAxioms = allAxioms.length;

    // 重複除去: axiom文字列が同じものを統合
    const mergedAxioms = this.config.deduplicateIds
      ? this.deduplicateAxioms(allAxioms)
      : allAxioms;

    const uniqueAxioms = mergedAxioms.length;
    const duplicatesRemoved = totalAxioms - uniqueAxioms;

    // 推定圧縮率: ユニーク公理数/全公理数（少ないほど圧縮効果大）
    const compressionHint = totalAxioms > 0 ? uniqueAxioms / totalAxioms : 1.0;

    return {
      totalChunks: chunks.length,
      totalAxioms,
      uniqueAxioms,
      duplicatesRemoved,
      chunkResults,
      mergedAxioms,
      totalMs: Date.now() - t0,
      compressionHint,
    };
  }

  /** axiom文字列のハッシュで重複除去 */
  private deduplicateAxioms(axioms: SeedTheory[]): SeedTheory[] {
    const seen = new Map<string, SeedTheory>();
    for (const axiom of axioms) {
      // axiomの内容をキーにする（IDは異なっても内容が同じなら重複）
      const key = createHash('sha256')
        .update(axiom.axiom.trim() + axiom.category)
        .digest('hex')
        .slice(0, 16);
      if (!seen.has(key)) {
        seen.set(key, axiom);
      } else {
        // 既存のものにキーワードをマージ（情報を保持）
        const existing = seen.get(key)!;
        const mergedKw = [...new Set([...existing.keywords, ...axiom.keywords])];
        seen.set(key, { ...existing, keywords: mergedKw });
      }
    }
    return [...seen.values()];
  }

  getConfig(): Required<ChunkConfig> {
    return { ...this.config };
  }
}
