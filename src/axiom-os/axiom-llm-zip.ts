import * as zlib from 'zlib';
import { createHash } from 'crypto';
import type { SeedTheory } from './seed-kernel';

/**
 * AxiomLLMZip — D-FUMT版LLMZip圧縮エンジン
 *
 * LLMZip（Haris Iqbal, 2023）の思想をD-FUMT公理列に適用。
 * LocalAxiomLLMの代わりに統計モデル（N-gram的予測）を使い、
 * LLMがなくても動作する設計。
 *
 * 圧縮フロー:
 *   公理列 → 予測モデル構築 → 各公理を予測→差分保存 → gzip
 *
 * 予測モデル:
 *   - カテゴリ遷移確率表（前の公理のカテゴリ → 次のカテゴリの確率）
 *   - キーワード共起表（よく一緒に出るキーワードのペア）
 *   - axiomプレフィクス辞書（頻出する書き出しパターン）
 */

/** 予測結果 */
export interface Prediction {
  predictedCategory: string;
  predictedKeywords: string[];
  predictedAxiomPrefix: string;    // axiom文字列の予測プレフィクス
  confidence: number;              // 予測信頼度 0.0〜1.0
}

/** 圧縮エントリ */
export interface LLMZipEntry {
  type: 'hit' | 'miss';
  id: string;
  // type='hit': 予測が当たった（差分のみ保存）
  axiomSuffix?: string;      // プレフィクスを除いた残り（予測プレフィクスが外れた場合）
  categoryMatch: boolean;    // カテゴリが予測通りか
  keywordDiff?: string[];    // 予測と異なるキーワード
  // type='miss': 予測が外れた（フル保存）
  axiom?: string;
  category?: string;
  keywords?: string[];
}

/** LLMZip圧縮結果 */
export interface LLMZipResult {
  data: Buffer;
  originalSize: number;
  compressedSize: number;
  ratio: number;
  hitRate: number;           // 予測ヒット率（0.0〜1.0）
  hitCount: number;
  missCount: number;
  modelEntries: number;      // 統計モデルのエントリ数
}

/** 統計予測モデル */
interface PredictionModel {
  // カテゴリ遷移表: Map<prevCategory, Map<nextCategory, count>>
  categoryTransition: Map<string, Map<string, number>>;
  // キーワード共起表: Map<keyword, Map<keyword, count>>
  keywordCooccurrence: Map<string, Map<string, number>>;
  // axiomプレフィクス辞書: Map<prefix, count>
  axiomPrefixes: Map<string, number>;
  // 全カテゴリの出現頻度
  categoryFreq: Map<string, number>;
}

/** モデルのシリアライズ形式 */
interface SerializedModel {
  categoryTransition: [string, [string, number][]][];
  keywordCooccurrence: [string, [string, number][]][];
  axiomPrefixes: [string, number][];
  categoryFreq: [string, number][];
}

export class AxiomLLMZip {

  /** 統計モデルを公理列から構築 */
  buildModel(axioms: SeedTheory[]): PredictionModel {
    const model: PredictionModel = {
      categoryTransition: new Map(),
      keywordCooccurrence: new Map(),
      axiomPrefixes: new Map(),
      categoryFreq: new Map(),
    };

    for (let i = 0; i < axioms.length; i++) {
      const a = axioms[i];

      // カテゴリ頻度
      model.categoryFreq.set(a.category, (model.categoryFreq.get(a.category) ?? 0) + 1);

      // カテゴリ遷移
      if (i > 0) {
        const prev = axioms[i - 1];
        if (!model.categoryTransition.has(prev.category)) {
          model.categoryTransition.set(prev.category, new Map());
        }
        const trans = model.categoryTransition.get(prev.category)!;
        trans.set(a.category, (trans.get(a.category) ?? 0) + 1);
      }

      // キーワード共起
      for (let j = 0; j < a.keywords.length; j++) {
        for (let k = j + 1; k < a.keywords.length; k++) {
          const kw1 = a.keywords[j], kw2 = a.keywords[k];
          if (!model.keywordCooccurrence.has(kw1)) {
            model.keywordCooccurrence.set(kw1, new Map());
          }
          const co = model.keywordCooccurrence.get(kw1)!;
          co.set(kw2, (co.get(kw2) ?? 0) + 1);
        }
      }

      // axiomプレフィクス（最初の10文字）
      if (a.axiom.length >= 5) {
        const prefix = a.axiom.slice(0, Math.min(10, a.axiom.length));
        model.axiomPrefixes.set(prefix, (model.axiomPrefixes.get(prefix) ?? 0) + 1);
      }
    }

    return model;
  }

  /** モデルを使って次の公理を予測 */
  predict(prevAxiom: SeedTheory | null, model: PredictionModel): Prediction {
    // カテゴリ予測: 遷移確率が最も高いカテゴリ
    let predictedCategory = 'general';
    if (prevAxiom && model.categoryTransition.has(prevAxiom.category)) {
      const trans = model.categoryTransition.get(prevAxiom.category)!;
      let maxCount = 0;
      for (const [cat, count] of trans) {
        if (count > maxCount) { maxCount = count; predictedCategory = cat; }
      }
    } else if (model.categoryFreq.size > 0) {
      // 遷移情報がない場合は最頻出カテゴリ
      let maxCount = 0;
      for (const [cat, count] of model.categoryFreq) {
        if (count > maxCount) { maxCount = count; predictedCategory = cat; }
      }
    }

    // キーワード予測: 前の公理のキーワードと共起しやすいキーワード
    const predictedKeywords: string[] = [];
    if (prevAxiom) {
      for (const kw of prevAxiom.keywords) {
        if (model.keywordCooccurrence.has(kw)) {
          const co = model.keywordCooccurrence.get(kw)!;
          for (const [coKw, count] of co) {
            if (count >= 2 && !predictedKeywords.includes(coKw)) {
              predictedKeywords.push(coKw);
            }
          }
        }
      }
    }

    // axiomプレフィクス予測: 最頻出プレフィクス
    let predictedAxiomPrefix = '';
    let maxPrefixCount = 0;
    for (const [prefix, count] of model.axiomPrefixes) {
      if (count > maxPrefixCount) { maxPrefixCount = count; predictedAxiomPrefix = prefix; }
    }

    // 信頼度計算
    const catConf = prevAxiom && model.categoryTransition.has(prevAxiom.category) ? 0.6 : 0.3;
    const kwConf = predictedKeywords.length > 0 ? 0.3 : 0.0;
    const confidence = Math.min(1.0, catConf + kwConf);

    return { predictedCategory, predictedKeywords, predictedAxiomPrefix, confidence };
  }

  /** 予測と実際の公理を比較してLLMZipエントリを生成 */
  encodeEntry(
    axiom: SeedTheory,
    prediction: Prediction,
    hitThreshold: number = 0.4
  ): LLMZipEntry {
    const categoryMatch = prediction.predictedCategory === axiom.category;

    // axiomのプレフィクスが一致するか
    const prefixMatch = prediction.predictedAxiomPrefix.length >= 5 &&
      axiom.axiom.startsWith(prediction.predictedAxiomPrefix);

    // キーワードの差分
    const predKwSet = new Set(prediction.predictedKeywords);
    const actualKwSet = new Set(axiom.keywords);
    const keywordDiff = axiom.keywords.filter(k => !predKwSet.has(k));

    // ヒット判定: カテゴリが一致 + 予測信頼度が閾値以上
    const isHit = categoryMatch && prediction.confidence >= hitThreshold;

    if (isHit) {
      // HITの場合: カテゴリは省略、axiomは差分のみ保存
      const axiomSuffix = prefixMatch
        ? axiom.axiom.slice(prediction.predictedAxiomPrefix.length)
        : axiom.axiom;

      return {
        type: 'hit',
        id: axiom.id,
        axiomSuffix: axiomSuffix || undefined,
        categoryMatch,
        keywordDiff: keywordDiff.length > 0 ? keywordDiff : undefined,
      };
    } else {
      // MISSの場合: フル保存
      return {
        type: 'miss',
        id: axiom.id,
        axiom: axiom.axiom,
        category: axiom.category,
        keywords: axiom.keywords,
        categoryMatch,
      };
    }
  }

  /** エントリを復元して公理を再構築 */
  decodeEntry(
    entry: LLMZipEntry,
    prediction: Prediction,
    prevAxiom: SeedTheory | null
  ): SeedTheory {
    if (entry.type === 'miss') {
      return {
        id: entry.id,
        axiom: entry.axiom!,
        category: entry.category!,
        keywords: entry.keywords!,
      };
    }

    // HITの場合: 予測から復元
    const category = entry.categoryMatch ? prediction.predictedCategory : (prevAxiom?.category ?? 'general');

    const axiomPrefix = prediction.predictedAxiomPrefix;
    const axiom = entry.axiomSuffix !== undefined
      ? axiomPrefix + entry.axiomSuffix
      : axiomPrefix;

    // キーワード: 予測キーワード + 差分
    const baseKeywords = [...prediction.predictedKeywords];
    const keywords = entry.keywordDiff
      ? [...new Set([...baseKeywords, ...entry.keywordDiff])]
      : baseKeywords;

    return { id: entry.id, axiom, category, keywords };
  }

  /** 公理列をLLMZip圧縮 */
  compress(axioms: SeedTheory[], hitThreshold: number = 0.4): LLMZipResult {
    if (axioms.length === 0) {
      const empty = Buffer.concat([Buffer.from('REI\x04'), zlib.gzipSync('[]')]);
      return { data: empty, originalSize: 0, compressedSize: empty.length, ratio: 1, hitRate: 0, hitCount: 0, missCount: 0, modelEntries: 0 };
    }

    const originalSize = Buffer.byteLength(JSON.stringify(axioms), 'utf8');

    // Step 1: モデル構築（前半の公理から学習）
    const trainSize = Math.max(1, Math.floor(axioms.length * 0.7));
    const model = this.buildModel(axioms.slice(0, trainSize));

    // Step 2: 各公理をエンコード
    const entries: LLMZipEntry[] = [];
    let prevAxiom: SeedTheory | null = null;
    let hitCount = 0, missCount = 0;

    for (const axiom of axioms) {
      const prediction = this.predict(prevAxiom, model);
      const entry = this.encodeEntry(axiom, prediction, hitThreshold);
      entries.push(entry);
      if (entry.type === 'hit') hitCount++;
      else missCount++;
      prevAxiom = axiom;
    }

    // Step 3: モデルをシリアライズ（復元に必要）
    const modelData = this.serializeModel(model);

    // Step 4: gzip圧縮
    const payload = JSON.stringify({ modelData, entries });
    const compressed = zlib.gzipSync(Buffer.from(payload, 'utf8'), { level: 9 });
    const data = Buffer.concat([Buffer.from('REI\x04'), compressed]);

    return {
      data,
      originalSize,
      compressedSize: data.length,
      ratio: data.length / originalSize,
      hitRate: axioms.length > 0 ? hitCount / axioms.length : 0,
      hitCount,
      missCount,
      modelEntries: model.categoryTransition.size + model.keywordCooccurrence.size,
    };
  }

  /** 復元 */
  decompress(data: Buffer): SeedTheory[] {
    const magic = data.subarray(0, 4).toString();
    if (magic !== 'REI\x04') throw new Error(`Invalid format: ${magic}`);

    const payload = zlib.gunzipSync(data.subarray(4)).toString('utf8');
    const { modelData, entries } = JSON.parse(payload) as {
      modelData: SerializedModel;
      entries: LLMZipEntry[];
    };

    const model = this.deserializeModel(modelData);
    const axioms: SeedTheory[] = [];
    let prevAxiom: SeedTheory | null = null;

    for (const entry of entries) {
      const prediction = this.predict(prevAxiom, model);
      const axiom = this.decodeEntry(entry, prediction, prevAxiom);
      axioms.push(axiom);
      prevAxiom = axiom;
    }

    return axioms;
  }

  /** モデルのシリアライズ */
  private serializeModel(model: PredictionModel): SerializedModel {
    return {
      categoryTransition: [...model.categoryTransition.entries()].map(([k, v]) => [k, [...v.entries()]]),
      keywordCooccurrence: [...model.keywordCooccurrence.entries()].map(([k, v]) => [k, [...v.entries()]]),
      axiomPrefixes: [...model.axiomPrefixes.entries()],
      categoryFreq: [...model.categoryFreq.entries()],
    };
  }

  private deserializeModel(data: SerializedModel): PredictionModel {
    return {
      categoryTransition: new Map(data.categoryTransition.map(([k, v]) => [k, new Map(v)])),
      keywordCooccurrence: new Map(data.keywordCooccurrence.map(([k, v]) => [k, new Map(v)])),
      axiomPrefixes: new Map(data.axiomPrefixes),
      categoryFreq: new Map(data.categoryFreq),
    };
  }

  /** ヒット率と圧縮率の統計情報 */
  analyzeCompression(result: LLMZipResult): string {
    return [
      `圧縮率: ${(result.ratio * 100).toFixed(1)}%`,
      `ヒット率: ${(result.hitRate * 100).toFixed(1)}%`,
      `ヒット: ${result.hitCount}件 / ミス: ${result.missCount}件`,
      `モデルエントリ数: ${result.modelEntries}`,
    ].join('\n');
  }
}
