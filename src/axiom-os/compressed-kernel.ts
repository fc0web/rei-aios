/**
 * CompressedKernel — AxiomEncoder + brotli で圧縮した75理論の最小データ
 *
 * SEED_KERNEL (9KB) をさらに記号化 + brotli 圧縮し、フルデータの10%以下を目指す。
 *
 * compress():
 *   1. カテゴリソート → 記号化 → タブ区切りテキスト化
 *   2. brotli 圧縮 (quality 11)
 *   3. base64 エンコードした文字列を返す
 */

import { brotliCompressSync, brotliDecompressSync, constants } from 'node:zlib';
import { SEED_KERNEL, type SeedTheory } from './seed-kernel';
import { SEED_THEORIES } from './seed';
import { AxiomEncoder, type EncodedSeed } from './axiom-encoder';

const encoder = new AxiomEncoder();

/** 全75理論をエンコード済みで保持 */
export const COMPRESSED_KERNEL: EncodedSeed[] = SEED_KERNEL.map(s => encoder.encodeSeed(s));

const ID_PREFIX = 'dfumt-';

export class CompressedKernel {
  private readonly enc = new AxiomEncoder();

  /** テキスト形式に変換（カテゴリソート済み、改行区切り） */
  private toText(): string {
    const sorted = SEED_KERNEL.slice().sort((a, b) => a.category.localeCompare(b.category));
    return sorted.map(s => {
      const e = this.enc.encodeSeed(s);
      const idSuffix = e.i.startsWith(ID_PREFIX) ? e.i.slice(ID_PREFIX.length) : e.i;
      // キーワードも記号化して圧縮
      const encodedKws = e.k.map(kw => this.enc.encode(kw));
      return `${idSuffix}\t${e.a}\t${e.c}\t${encodedKws.join(';')}`;
    }).join('\n');
  }

  /** テキスト形式から SeedTheory[] を復元 */
  private fromText(text: string): SeedTheory[] {
    return text.split('\n').map(line => {
      const [idSuffix, a, c, kwStr] = line.split('\t');
      // キーワードもデコード
      const decodedKws = kwStr.split(';').map(kw => this.enc.decode(kw));
      return this.enc.decodeSeed({
        i: ID_PREFIX + idSuffix,
        a,
        c,
        k: decodedKws,
      });
    });
  }

  /** 全データを圧縮文字列に変換（brotli → base64） */
  compress(): string {
    const compressed = brotliCompressSync(Buffer.from(this.toText(), 'utf-8'), {
      params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
    });
    return compressed.toString('base64');
  }

  /** 圧縮データから元のSeedTheoryを復元 */
  decompress(data: string): SeedTheory[] {
    const decompressed = brotliDecompressSync(Buffer.from(data, 'base64'));
    return this.fromText(decompressed.toString('utf-8'));
  }

  /** brotli圧縮されたバイナリサイズを取得する */
  compressedBinarySize(): number {
    return brotliCompressSync(Buffer.from(this.toText(), 'utf-8'), {
      params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
    }).length;
  }

  /** サイズ比較レポート */
  sizeReport(): {
    originalSize: number;
    compressedSize: number;
    fullSize: number;
    ratio: number;
  } {
    const originalSize = Buffer.byteLength(JSON.stringify(SEED_KERNEL), 'utf-8');
    const compressedSize = this.compressedBinarySize();
    const fullSize = Buffer.byteLength(JSON.stringify(SEED_THEORIES), 'utf-8');
    return {
      originalSize,
      compressedSize,
      fullSize,
      ratio: compressedSize / fullSize,
    };
  }
}
