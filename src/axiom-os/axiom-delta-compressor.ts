import { createHash } from 'crypto';
import * as zlib from 'zlib';
import type { SeedTheory } from './seed-kernel';

/** キーワード辞書エントリ */
export interface DictEntry {
  token: string;       // 元の文字列
  code: string;        // 置換コード（例: §0, §1, ...）
  frequency: number;   // 出現回数
  saving: number;      // 節約バイト数
}

/** デルタエントリ（前の公理との差分） */
export interface DeltaEntry {
  type: 'full' | 'delta';
  id: string;
  // type='full'の場合: 全フィールドを持つ
  axiom?: string;
  category?: string;
  keywords?: string[];
  // type='delta'の場合: 変化したフィールドのみ
  deltaAxiom?: string;        // 変化した場合のみ
  deltaCategory?: string;     // 変化した場合のみ
  addedKeywords?: string[];   // 追加されたキーワード
  removedKeywords?: string[]; // 削除されたキーワード
}

/** 圧縮結果 */
export interface DeltaCompressionResult {
  data: Buffer;
  originalSize: number;
  compressedSize: number;
  ratio: number;
  dictSize: number;       // 辞書エントリ数
  deltaCount: number;     // デルタエントリ数（差分保存できた数）
  fullCount: number;      // フル保存したエントリ数
}

export class AxiomDeltaCompressor {

  /** 辞書を構築（キーワード・カテゴリ・axiom部分文字列の頻出パターン） */
  buildDictionary(axioms: SeedTheory[]): DictEntry[] {
    const freq = new Map<string, number>();

    // キーワードの頻度カウント
    for (const a of axioms) {
      for (const kw of a.keywords) {
        freq.set(kw, (freq.get(kw) ?? 0) + 1);
      }
      // カテゴリも辞書化
      freq.set(a.category, (freq.get(a.category) ?? 0) + 1);
      // axiom内の頻出部分文字列（5文字以上・3回以上出現）
      for (let len = 5; len <= Math.min(a.axiom.length, 30); len++) {
        for (let i = 0; i <= a.axiom.length - len; i++) {
          const sub = a.axiom.slice(i, i + len);
          if (/\s/.test(sub[0]) || /\s/.test(sub[sub.length - 1])) continue;
          freq.set(sub, (freq.get(sub) ?? 0) + 1);
        }
      }
    }

    // 節約バイト計算でフィルタ・ソート
    const entries: DictEntry[] = [];
    let codeIndex = 0;
    for (const [token, frequency] of freq) {
      if (frequency < 2) continue;
      const code = `§${codeIndex}`;
      const saving = (token.length - code.length) * frequency;
      if (saving > 0) {
        entries.push({ token, code, frequency, saving });
        codeIndex++;
      }
    }

    // 節約量が大きい順にソートし、上位100件に絞る
    return entries
      .sort((a, b) => b.saving - a.saving)
      .slice(0, 100);
  }

  /** 辞書を使ってテキストを圧縮（長いトークンから先に置換） */
  applyDictionary(text: string, dict: DictEntry[]): string {
    // 長いトークンから先に置換して短いトークンとの衝突を防ぐ
    const sorted = [...dict].sort((a, b) => b.token.length - a.token.length);
    let result = text;
    for (const entry of sorted) {
      result = result.split(entry.token).join(entry.code);
    }
    return result;
  }

  /** 辞書を使ってテキストを展開（長いコードから先に展開して§1/§10衝突を防ぐ） */
  reverseDictionary(text: string, dict: DictEntry[]): string {
    // コード長が長いものから先に展開（§10 → §1 の順で、prefix衝突を防ぐ）
    const sorted = [...dict].sort((a, b) => b.code.length - a.code.length || b.token.length - a.token.length);
    let result = text;
    for (const entry of sorted) {
      result = result.split(entry.code).join(entry.token);
    }
    return result;
  }

  /** デルタエントリを生成（前の公理との差分のみ保存） */
  computeDelta(prev: SeedTheory, curr: SeedTheory): DeltaEntry {
    const prevKwSet = new Set(prev.keywords);
    const currKwSet = new Set(curr.keywords);
    const addedKeywords = curr.keywords.filter(k => !prevKwSet.has(k));
    const removedKeywords = prev.keywords.filter(k => !currKwSet.has(k));

    const hasAxiomChange = prev.axiom !== curr.axiom;
    const hasCategoryChange = prev.category !== curr.category;
    const hasKwChange = addedKeywords.length > 0 || removedKeywords.length > 0;

    // 変化がない場合もIDは必ず保存
    if (!hasAxiomChange && !hasCategoryChange && !hasKwChange) {
      return { type: 'delta', id: curr.id };
    }

    const delta: DeltaEntry = { type: 'delta', id: curr.id };
    if (hasAxiomChange) delta.deltaAxiom = curr.axiom;
    if (hasCategoryChange) delta.deltaCategory = curr.category;
    if (addedKeywords.length > 0) delta.addedKeywords = addedKeywords;
    if (removedKeywords.length > 0) delta.removedKeywords = removedKeywords;

    // デルタのサイズ vs フルのサイズを比較して、フルの方が小さければフル保存
    const deltaSize = JSON.stringify(delta).length;
    const fullSize = JSON.stringify({ type: 'full', id: curr.id, axiom: curr.axiom, category: curr.category, keywords: curr.keywords }).length;
    if (deltaSize >= fullSize * 0.8) {
      return {
        type: 'full',
        id: curr.id,
        axiom: curr.axiom,
        category: curr.category,
        keywords: curr.keywords,
      };
    }
    return delta;
  }

  /** 公理列を辞書+デルタ圧縮してBufferに変換 */
  compress(axioms: SeedTheory[]): DeltaCompressionResult {
    if (axioms.length === 0) {
      const empty = Buffer.from('[]');
      return { data: empty, originalSize: 0, compressedSize: 0, ratio: 1, dictSize: 0, deltaCount: 0, fullCount: 0 };
    }

    const originalSize = Buffer.byteLength(JSON.stringify(axioms), 'utf8');

    // Step 1: 辞書構築
    const dict = this.buildDictionary(axioms);

    // Step 2: デルタエントリ生成
    const entries: DeltaEntry[] = [];
    let deltaCount = 0;
    let fullCount = 0;

    // 最初の公理は常にフル保存
    entries.push({
      type: 'full',
      id: axioms[0].id,
      axiom: axioms[0].axiom,
      category: axioms[0].category,
      keywords: axioms[0].keywords,
    });
    fullCount++;

    for (let i = 1; i < axioms.length; i++) {
      const entry = this.computeDelta(axioms[i - 1], axioms[i]);
      entries.push(entry);
      if (entry.type === 'delta') deltaCount++;
      else fullCount++;
    }

    // Step 3: JSON化 → 辞書適用 → gzip
    const entriesJson = JSON.stringify(entries);
    const dictJson = JSON.stringify(dict.map(d => [d.token, d.code]));
    const withDictApplied = this.applyDictionary(entriesJson, dict);
    const payload = dictJson + '\x00' + withDictApplied;
    const compressed = zlib.gzipSync(Buffer.from(payload, 'utf8'), { level: 9 });

    // マジックバイト付き
    const data = Buffer.concat([Buffer.from('REI\x03'), compressed]);

    return {
      data,
      originalSize,
      compressedSize: data.length,
      ratio: data.length / originalSize,
      dictSize: dict.length,
      deltaCount,
      fullCount,
    };
  }

  /** 復元 */
  decompress(data: Buffer): SeedTheory[] {
    const magic = data.subarray(0, 4).toString();
    if (magic !== 'REI\x03') throw new Error(`Invalid format: ${magic}`);

    const payload = zlib.gunzipSync(data.subarray(4)).toString('utf8');
    const sepIdx = payload.indexOf('\x00');
    const dictJson = payload.slice(0, sepIdx);
    const entriesJson = payload.slice(sepIdx + 1);

    // 辞書を復元
    const dictPairs: [string, string][] = JSON.parse(dictJson);
    const dict: DictEntry[] = dictPairs.map(([token, code]) => ({
      token, code, frequency: 0, saving: 0,
    }));

    // 辞書を逆適用してエントリを復元
    const restored = this.reverseDictionary(entriesJson, dict);
    const entries: DeltaEntry[] = JSON.parse(restored);

    // デルタを展開して公理列に復元
    const axioms: SeedTheory[] = [];
    let prev: SeedTheory | null = null;

    for (const entry of entries) {
      if (entry.type === 'full') {
        const axiom: SeedTheory = {
          id: entry.id,
          axiom: entry.axiom!,
          category: entry.category!,
          keywords: entry.keywords!,
        };
        axioms.push(axiom);
        prev = axiom;
      } else {
        // delta: prevを基にして変化分だけ適用
        if (!prev) throw new Error('Delta entry without previous axiom');
        const kwSet = new Set(prev.keywords);
        if (entry.removedKeywords) entry.removedKeywords.forEach(k => kwSet.delete(k));
        if (entry.addedKeywords) entry.addedKeywords.forEach(k => kwSet.add(k));
        const axiom: SeedTheory = {
          id: entry.id,
          axiom: entry.deltaAxiom ?? prev.axiom,
          category: entry.deltaCategory ?? prev.category,
          keywords: [...kwSet],
        };
        axioms.push(axiom);
        prev = axiom;
      }
    }
    return axioms;
  }
}
