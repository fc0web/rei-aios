/**
 * CompressedKernel v3 — AxiomEncoder + brotli で圧縮した75理論の最小データ
 *
 * v3の改善点（v2からの変更）:
 *   - ID連番 + 1文字カテゴリ（v2継承）
 *   - 辞書方式廃止 → エンコード済みキーワード直書き（brotliの自然な重複排除に委ねる）
 *   - IDもBase36化で短縮
 */

import { brotliCompressSync, brotliDecompressSync, constants } from 'node:zlib';
import { SEED_KERNEL, type SeedTheory } from './seed-kernel';
import { SEED_THEORIES } from './seed';
import { AxiomEncoder, type EncodedSeed } from './axiom-encoder';

const encoder = new AxiomEncoder();

export const COMPRESSED_KERNEL: EncodedSeed[] = SEED_KERNEL.map(s => encoder.encodeSeed(s));

const BROTLI_OPTIONS = {
  params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
};

/** カテゴリ → 1文字コード */
const CAT1: Record<string, string> = {
  'zero_extension': '0',
  'logic':          '1',
  'computation':    '2',
  'mathematics':    '3',
  'consciousness':  '4',
  'general':        '5',
  'number-system':  '6',
  'expansion':      '7',
  'ai-integration': '8',
  'unified':        '9',
  'projection':     'A',
  'cosmic':         'B',
};

const CAT1_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(CAT1).map(([k, v]) => [v, k]),
);

export class CompressedKernel {
  private readonly enc = new AxiomEncoder();

  private toText(): string {
    const sorted = SEED_KERNEL.slice().sort((a, b) => a.category.localeCompare(b.category));
    const idToIndex = new Map(SEED_KERNEL.map((s, i) => [s.id, i]));

    return sorted.map(s => {
      const idx = idToIndex.get(s.id)!.toString(36);
      const axiom = this.enc.encode(s.axiom);
      const cat = CAT1[s.category] ?? s.category;
      const kws = s.keywords.map(kw => this.enc.encode(kw)).join(';');
      return `${idx}\t${axiom}\t${cat}\t${kws}`;
    }).join('\n');
  }

  private fromText(text: string): SeedTheory[] {
    const indexToId = SEED_KERNEL.map(s => s.id);

    return text.split('\n').map(line => {
      const [idxStr, a, c, kwStr] = line.split('\t');
      const idx = parseInt(idxStr, 36);
      const id = indexToId[idx];
      const axiom = this.enc.decode(a);
      const category = CAT1_REVERSE[c] ?? c;
      const keywords = kwStr.split(';').map(kw => this.enc.decode(kw));
      return { id, axiom, category, keywords };
    });
  }

  compress(): string {
    const compressed = brotliCompressSync(Buffer.from(this.toText(), 'utf-8'), BROTLI_OPTIONS);
    return compressed.toString('base64');
  }

  decompress(data: string): SeedTheory[] {
    const decompressed = brotliDecompressSync(Buffer.from(data, 'base64'));
    return this.fromText(decompressed.toString('utf-8'));
  }

  compressedBinarySize(): number {
    return brotliCompressSync(Buffer.from(this.toText(), 'utf-8'), BROTLI_OPTIONS).length;
  }

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
