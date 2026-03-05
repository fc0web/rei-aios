/**
 * AxiomStreamCompressor — ストリーム圧縮エンジン
 *
 * 無限に流れる公理列をウィンドウ単位で圧縮・出力する。
 * IoT的なリアルタイム公理抽出・圧縮に対応。
 *
 * 設計:
 * - ウィンドウサイズ（デフォルト20公理）ごとに圧縮チャンクを出力
 * - 各チャンクは独立して復元可能
 * - 方式は自動選択（AxiomCompressionSelectorを使用）
 */

import type { SeedTheory } from './seed-kernel';
import { AxiomCompressionSelector, type CompressionMethod } from './axiom-compression-selector';

export interface StreamConfig {
  windowSize: number;       // ウィンドウサイズ（デフォルト: 20）
  overlap: number;          // チャンク間オーバーラップ（デフォルト: 0）
  method: CompressionMethod; // 圧縮方式（デフォルト: 'auto'）
  maxBufferSize: number;    // 最大バッファサイズ（デフォルト: 100）
}

export interface StreamChunk {
  chunkId: number;
  data: Buffer;
  axiomCount: number;
  compressedSize: number;
  method: CompressionMethod;
  timestamp: number;
}

export interface StreamStats {
  totalAxioms: number;
  totalChunks: number;
  totalCompressedBytes: number;
  totalOriginalBytes: number;
  overallRatio: number;
  avgChunkSize: number;
}

export class AxiomStreamCompressor {
  private config: Required<StreamConfig>;
  private selector: AxiomCompressionSelector;
  private buffer: SeedTheory[] = [];
  private chunks: StreamChunk[] = [];
  private chunkIdCounter = 0;
  private stats: StreamStats = {
    totalAxioms: 0,
    totalChunks: 0,
    totalCompressedBytes: 0,
    totalOriginalBytes: 0,
    overallRatio: 1,
    avgChunkSize: 0,
  };

  constructor(config: Partial<StreamConfig> = {}) {
    this.config = {
      windowSize: config.windowSize ?? 20,
      overlap: config.overlap ?? 0,
      method: config.method ?? 'auto',
      maxBufferSize: config.maxBufferSize ?? 100,
    };
    this.selector = new AxiomCompressionSelector();
  }

  /** 公理をストリームに追加 */
  push(axiom: SeedTheory): StreamChunk | null {
    this.buffer.push(axiom);
    this.stats.totalAxioms++;

    // バッファがウィンドウサイズに達したらチャンクを出力
    if (this.buffer.length >= this.config.windowSize) {
      return this.flushWindow();
    }
    // バッファが最大サイズを超えたら強制フラッシュ
    if (this.buffer.length >= this.config.maxBufferSize) {
      return this.flushWindow();
    }
    return null;
  }

  /** 複数公理を一括追加 */
  pushAll(axioms: SeedTheory[]): StreamChunk[] {
    const emitted: StreamChunk[] = [];
    for (const axiom of axioms) {
      const chunk = this.push(axiom);
      if (chunk) emitted.push(chunk);
    }
    return emitted;
  }

  /** バッファに残った公理を強制フラッシュ */
  flush(): StreamChunk | null {
    if (this.buffer.length === 0) return null;
    return this.flushWindow();
  }

  /** ウィンドウをチャンクに圧縮して出力 */
  private flushWindow(): StreamChunk {
    const window = this.buffer.slice(0, this.config.windowSize);
    const originalSize = Buffer.byteLength(JSON.stringify(window), 'utf8');

    const result = this.selector.compress(window, this.config.method);

    const chunk: StreamChunk = {
      chunkId: this.chunkIdCounter++,
      data: result.data,
      axiomCount: window.length,
      compressedSize: result.data.length,
      method: result.method,
      timestamp: Date.now(),
    };

    this.chunks.push(chunk);
    this.stats.totalChunks++;
    this.stats.totalCompressedBytes += chunk.compressedSize;
    this.stats.totalOriginalBytes += originalSize;
    this.stats.overallRatio = this.stats.totalOriginalBytes > 0
      ? this.stats.totalCompressedBytes / this.stats.totalOriginalBytes
      : 1;
    this.stats.avgChunkSize = this.stats.totalCompressedBytes / this.stats.totalChunks;

    // オーバーラップを残してバッファを更新
    this.buffer = this.buffer.slice(window.length - this.config.overlap);
    return chunk;
  }

  /** チャンクから公理を復元 */
  decompressChunk(chunk: StreamChunk): SeedTheory[] {
    return this.selector.decompress(chunk.data);
  }

  /** 全チャンクを順番に復元して結合 */
  decompressAll(): SeedTheory[] {
    const all: SeedTheory[] = [];
    const seen = new Set<string>();
    for (const chunk of this.chunks) {
      const axioms = this.decompressChunk(chunk);
      for (const axiom of axioms) {
        if (!seen.has(axiom.id)) {
          seen.add(axiom.id);
          all.push(axiom);
        }
      }
    }
    return all;
  }

  getStats(): StreamStats { return { ...this.stats }; }
  getChunks(): StreamChunk[] { return [...this.chunks]; }
  getBufferSize(): number { return this.buffer.length; }
  getConfig(): Required<StreamConfig> { return { ...this.config }; }

  /** バッファとチャンクをリセット */
  reset(): void {
    this.buffer = [];
    this.chunks = [];
    this.chunkIdCounter = 0;
    this.stats = { totalAxioms: 0, totalChunks: 0, totalCompressedBytes: 0, totalOriginalBytes: 0, overallRatio: 1, avgChunkSize: 0 };
  }
}
