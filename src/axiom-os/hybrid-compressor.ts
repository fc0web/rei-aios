/**
 * HybridCompressor -- 3段階ハイブリッド圧縮エンジン
 *
 * Step A: 辞書最適化（カテゴリ・キーワード・source辞書化 + ID短縮 + axiom記号化）
 * Step B: 予測圧縮（頻出サブストリングを参照に置換）
 * Step C: zlib gzip バイナリ圧縮
 *
 * 中間フォーマットはJSON構造オーバーヘッドを排除した行区切りテキスト。
 */

import * as zlib from 'zlib';
import { type SeedTheory } from './seed-kernel';
import { AxiomEncoder } from './axiom-encoder';

// ─── 圧縮結果 ──────────────────────────────────────────────

export interface CompressionResult {
  compressed: Buffer;
  steps: {
    original: number;
    afterDict: number;
    afterPredict: number;
    afterGzip: number;
  };
  ratio: number;
  meta: CompressedMeta;
}

export interface CompressedMeta {
  version: 2;
  axiomCount: number;
  keywordDict: string[];
  categoryDict: string[];
  sourceDict: string[];
  seqDict: string[];
}

// ─── 内部フォーマット ───────────────────────────────────────

const HEADER_SEP = '\x00';  // ヘッダーセクション区切り
const LINE_SEP = '\n';      // 行区切り
const FIELD_SEP = '\t';     // フィールド区切り
const KW_SEP = ',';         // キーワードインデックス区切り

function escapeField(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\t/g, '\\t').replace(/\n/g, '\\n').replace(/\x00/g, '\\0');
}
function unescapeField(s: string): string {
  // 単一パスで処理し \\n（リテラルバックスラッシュ+n）と \n（改行エスケープ）を正しく区別
  return s.replace(/\\([\\nt0])/g, (_, c) => {
    if (c === '\\') return '\\';
    if (c === 'n') return '\n';
    if (c === 't') return '\t';
    return '\x00';
  });
}

// ─── HybridCompressor ─────────────────────────────────────

export class HybridCompressor {
  private encoder = new AxiomEncoder();

  compress(axioms: Array<SeedTheory & { source?: string }>): CompressionResult {
    const originalJson = JSON.stringify(axioms);
    const originalSize = Buffer.byteLength(originalJson, 'utf8');

    // Step A: 辞書最適化 → 行区切りテキスト
    const { text: dictText, meta } = this.stepA_dictOptimize(axioms);
    const dictSize = Buffer.byteLength(dictText, 'utf8');

    // Step B: 予測圧縮
    const { text: predictedText, seqDict } = this.stepB_predict(dictText, meta);
    const predictedSize = Buffer.byteLength(predictedText, 'utf8');
    meta.seqDict = seqDict;

    // Step C: gzip
    const compressed = zlib.gzipSync(Buffer.from(predictedText, 'utf8'), { level: 9 });

    return {
      compressed,
      steps: { original: originalSize, afterDict: dictSize, afterPredict: predictedSize, afterGzip: compressed.length },
      ratio: compressed.length / originalSize,
      meta,
    };
  }

  decompress(compressed: Buffer): Array<SeedTheory & { source?: string }> {
    const text = zlib.gunzipSync(compressed).toString('utf8');
    const { header, body } = this.splitHeaderBody(text);
    const meta = this.parseHeader(header);

    // Step B逆: 予測展開
    const expandedBody = this.stepB_unpredict(body, meta.seqDict);

    // Step A逆: 辞書展開
    return this.stepA_dictRestore(expandedBody, meta);
  }

  // ─── Step A: 辞書最適化 ────────────────────────────────────

  private stepA_dictOptimize(axioms: Array<SeedTheory & { source?: string }>): { text: string; meta: CompressedMeta } {
    // キーワード辞書
    const kwFreq = new Map<string, number>();
    for (const a of axioms) {
      for (const kw of a.keywords) kwFreq.set(kw, (kwFreq.get(kw) ?? 0) + 1);
    }
    const keywordDict = [...kwFreq.entries()].sort((a, b) => b[1] - a[1]).map(([kw]) => kw);
    const kwIndex = new Map<string, number>();
    keywordDict.forEach((kw, i) => kwIndex.set(kw, i));

    // カテゴリ辞書
    const categoryDict = [...new Set(axioms.map(a => a.category))];
    const catIndex = new Map<string, number>();
    categoryDict.forEach((c, i) => catIndex.set(c, i));

    // source辞書（2回以上出現）
    const srcFreq = new Map<string, number>();
    for (const a of axioms) {
      if (a.source) srcFreq.set(a.source, (srcFreq.get(a.source) ?? 0) + 1);
    }
    const sourceDictOriginal = [...srcFreq.entries()]
      .filter(([, freq]) => freq >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([src]) => src);
    const sourceDict = sourceDictOriginal.map(s => escapeField(s));
    const srcIndex = new Map<string, number>();
    sourceDictOriginal.forEach((src, i) => srcIndex.set(src, i));

    const meta: CompressedMeta = {
      version: 2,
      axiomCount: axioms.length,
      keywordDict,
      categoryDict,
      sourceDict,
      seqDict: [],
    };

    // ヘッダー: 辞書情報
    const headerLines = [
      `v2`,
      `K:${keywordDict.join(KW_SEP)}`,
      `C:${categoryDict.join(KW_SEP)}`,
      `S:${sourceDict.join(FIELD_SEP)}`,
    ];
    const header = headerLines.join(LINE_SEP);

    // ボディ: 各公理を1行に
    const bodyLines: string[] = [];
    for (const a of axioms) {
      const shortId = this.shortenId(a.id);
      const encoded = this.encoder.encode(a.axiom);
      const catIdx = catIndex.get(a.category) ?? 0;
      const kwIdxs = a.keywords.map(kw => kwIndex.get(kw)!).join(KW_SEP);

      // source参照: ~N = 辞書インデックス, それ以外 = インライン（エスケープ）
      let srcRef = '';
      if (a.source) {
        const sIdx = srcIndex.get(a.source);
        if (sIdx !== undefined) {
          srcRef = `~${sIdx}`;
        } else if (a.source.length >= 20) {
          srcRef = escapeField(a.source);
        }
      }

      bodyLines.push([shortId, encoded, catIdx, kwIdxs, srcRef].join(FIELD_SEP));
    }

    const text = header + HEADER_SEP + bodyLines.join(LINE_SEP);
    return { text, meta };
  }

  private stepA_dictRestore(body: string, meta: CompressedMeta): Array<SeedTheory & { source?: string }> {
    const { keywordDict, categoryDict, sourceDict } = meta;
    const lines = body.split(LINE_SEP).filter(l => l.length > 0);

    return lines.map(line => {
      const [shortId, encodedAxiom, catIdxStr, kwIdxsStr, srcRef] = line.split(FIELD_SEP);
      const result: SeedTheory & { source?: string } = {
        id: this.restoreId(shortId),
        axiom: this.encoder.decode(encodedAxiom),
        category: categoryDict[parseInt(catIdxStr)] ?? 'general',
        keywords: kwIdxsStr ? kwIdxsStr.split(KW_SEP).map(i => keywordDict[parseInt(i)] ?? '') : [],
      };

      if (srcRef) {
        if (srcRef.startsWith('~')) {
          result.source = unescapeField(sourceDict[parseInt(srcRef.slice(1))] ?? '');
        } else {
          result.source = unescapeField(srcRef);
        }
      }
      return result;
    });
  }

  // ─── Step B: 予測圧縮 ──────────────────────────────────────

  private stepB_predict(text: string, _meta: CompressedMeta): { text: string; seqDict: string[] } {
    const { header, body } = this.splitHeaderBody(text);
    const lines = body.split(LINE_SEP);

    // axiomフィールド（index=1）のみから頻出パターンを検出（sourceには触れない）
    const axiomStrings: string[] = [];
    for (const line of lines) {
      const idx = line.indexOf(FIELD_SEP);
      if (idx < 0) continue;
      const rest = line.substring(idx + 1);
      const idx2 = rest.indexOf(FIELD_SEP);
      if (idx2 >= 0) axiomStrings.push(rest.substring(0, idx2));
    }

    const seqDict = this.findFrequentSubstrings(axiomStrings, 5, 20);
    if (seqDict.length === 0) return { text, seqDict: [] };

    // axiomフィールドのみに置換を適用
    const newLines = lines.map(line => {
      const fields = line.split(FIELD_SEP);
      if (fields.length < 2) return line;
      let axiom = fields[1];
      for (let i = 0; i < seqDict.length; i++) {
        axiom = axiom.split(seqDict[i]).join(`$${i}`);
      }
      fields[1] = axiom;
      return fields.join(FIELD_SEP);
    });

    const seqLine = `Q:${seqDict.join(FIELD_SEP)}`;
    const newHeader = header + LINE_SEP + seqLine;
    return { text: newHeader + HEADER_SEP + newLines.join(LINE_SEP), seqDict };
  }

  private stepB_unpredict(body: string, seqDict: string[]): string {
    if (!seqDict || seqDict.length === 0) return body;
    // axiomフィールド（index=1）のみ展開
    const lines = body.split(LINE_SEP);
    const newLines = lines.map(line => {
      const fields = line.split(FIELD_SEP);
      if (fields.length < 2) return line;
      let axiom = fields[1];
      for (let i = seqDict.length - 1; i >= 0; i--) {
        axiom = axiom.split(`$${i}`).join(seqDict[i]);
      }
      fields[1] = axiom;
      return fields.join(FIELD_SEP);
    });
    return newLines.join(LINE_SEP);
  }

  // ─── ヘッダー/ボディ分離 ──────────────────────────────────

  private splitHeaderBody(text: string): { header: string; body: string } {
    const idx = text.indexOf(HEADER_SEP);
    if (idx < 0) return { header: '', body: text };
    return { header: text.substring(0, idx), body: text.substring(idx + 1) };
  }

  private parseHeader(header: string): CompressedMeta {
    const lines = header.split(LINE_SEP);
    const meta: CompressedMeta = {
      version: 2,
      axiomCount: 0,
      keywordDict: [],
      categoryDict: [],
      sourceDict: [],
      seqDict: [],
    };

    for (const line of lines) {
      if (line.startsWith('K:')) meta.keywordDict = line.slice(2).split(KW_SEP);
      else if (line.startsWith('C:')) meta.categoryDict = line.slice(2).split(KW_SEP);
      else if (line.startsWith('S:')) meta.sourceDict = line.slice(2) ? line.slice(2).split(FIELD_SEP) : [];
      else if (line.startsWith('Q:')) meta.seqDict = line.slice(2) ? line.slice(2).split(FIELD_SEP) : [];
    }

    return meta;
  }

  // ─── 頻出サブストリング検出 ─────────────────────────────────

  private findFrequentSubstrings(strings: string[], minLen: number, maxDict: number): string[] {
    const substringFreq = new Map<string, number>();

    for (const s of strings) {
      const seen = new Set<string>();
      for (let len = minLen; len <= Math.min(s.length, 50); len++) {
        for (let start = 0; start <= s.length - len; start++) {
          const sub = s.substring(start, start + len);
          if (!seen.has(sub)) {
            seen.add(sub);
            substringFreq.set(sub, (substringFreq.get(sub) ?? 0) + 1);
          }
        }
      }
    }

    const candidates = [...substringFreq.entries()]
      .filter(([, freq]) => freq >= 2)
      .map(([sub, freq]) => ({
        sub,
        freq,
        saving: sub.length * freq - (sub.length + 3 * freq),
      }))
      .filter(c => c.saving > 0)
      .sort((a, b) => b.saving - a.saving);

    const selected: string[] = [];
    for (const c of candidates) {
      if (selected.length >= maxDict) break;
      const overlaps = selected.some(s => s.includes(c.sub) || c.sub.includes(s));
      if (!overlaps) selected.push(c.sub);
    }

    return selected;
  }

  // ─── ID短縮 ─────────────────────────────────────────────────

  private readonly ID_KIND_MAP: Record<string, string> = {
    'compare': 'cm', 'constant': 'cn', 'compose': 'cp', 'branch': 'br',
    'loop': 'lp', 'transform': 'tf', 'reduce': 'rd', 'guard': 'gd',
    'class': 'cl', 'async': 'as', 'error': 'er', 'cast': 'ca',
    'collection': 'co', 'math': 'mt', 'string': 'st', 'object': 'ob',
    'module': 'md', 'state': 'sa', 'debug': 'db', 'recursion': 'rc',
  };

  private readonly ID_KIND_REVERSE: Record<string, string> = Object.fromEntries(
    Object.entries(this.ID_KIND_MAP).map(([k, v]) => [v, k]),
  );

  private shortenId(id: string): string {
    const parts = id.split('-');
    if (parts[0] === 'cae' && parts.length >= 3) {
      const kind = parts[1];
      const hash = parts.slice(2).join('-');
      return `${this.ID_KIND_MAP[kind] ?? kind.slice(0, 2)}-${hash}`;
    }
    return id;
  }

  private restoreId(shortId: string): string {
    const parts = shortId.split('-');
    if (parts.length === 2 && parts[1].length === 8 && /^[0-9a-f]+$/.test(parts[1])) {
      const kind = this.ID_KIND_REVERSE[parts[0]] ?? parts[0];
      return `cae-${kind}-${parts[1]}`;
    }
    return shortId;
  }

  // ─── ユーティリティ ──────────────────────────────────────────

  toBase64(result: CompressionResult): string {
    return result.compressed.toString('base64');
  }

  fromBase64(b64: string): Buffer {
    return Buffer.from(b64, 'base64');
  }

  serialize(result: CompressionResult): Buffer {
    const header = Buffer.from('REI\x02');
    return Buffer.concat([header, result.compressed]);
  }

  deserialize(buf: Buffer): Array<SeedTheory & { source?: string }> {
    const magic = buf.subarray(0, 4).toString();
    if (magic !== 'REI\x02') {
      throw new Error(`Invalid format: expected REI\\x02, got ${magic}`);
    }
    return this.decompress(buf.subarray(4));
  }
}
