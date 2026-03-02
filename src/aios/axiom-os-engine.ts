/**
 * 公理OS — 統合エンジン (axiom-os-engine.ts)
 *
 * 既存の axiom-brancher.ts に以下を追加統合する：
 *   1. 歴史人物講師システム（historian-personas.ts）
 *   2. 公理辞書システム（axiom-dictionary.ts）
 *
 * 使用方法:
 *   const engine = new AxiomOSEngine();
 *   const result = await engine.processQuestion(question, aiResponse);
 *   // result.branches       ← 3軸分岐（既存）
 *   // result.historians     ← 歴史人物の応答リスト（新規）
 *   // result.relatedAxioms  ← 関連公理リスト（新規）
 *
 * 既存コードへの影響: ゼロ（純粋な追加拡張）
 */

import { AxiomBrancher, BranchResult } from './axiom-brancher';
import { AxiomDictionary, AxiomEntry, getAxiomDictionary } from './axiom-dictionary';
import {
  HistorianPersona,
  HistorianResponse,
  recommendHistorians,
  getHistorianById,
  getFreeHistorians,
  CONTRASTING_PAIRS,
} from './historians/historian-personas';

// ─── 型定義 ──────────────────────────────────────────────────────────────────

export interface AxiomOSResult {
  /** 元のAI回答 */
  originalResponse: string;
  /** 既存の3軸分岐（axiom-brancherから） */
  branches: BranchResult;
  /** 歴史人物講師の応答リスト */
  historians: HistorianResponseResult[];
  /** 関連公理リスト */
  relatedAxioms: AxiomEntry[];
  /** 対立視点ペア（複数視点体験用） */
  contrastingPair?: ContrastingPairResult;
  /** 処理メタデータ */
  meta: AxiomOSMeta;
}

export interface HistorianResponseResult {
  historian: HistorianPersona;
  /** プロンプトテンプレートで生成された応答文（AI呼び出し前のテンプレート） */
  promptForAI: string;
  /** 推薦スコア（0.0 – 1.0） */
  recommendScore: number;
}

export interface ContrastingPairResult {
  historianA: HistorianPersona;
  historianB: HistorianPersona;
  theme: string;
}

export interface AxiomOSMeta {
  questionType: string;
  historianCount: number;
  relatedAxiomCount: number;
  processingMs: number;
  isPremiumContent: boolean; // 有料コンテンツを含むか
}

export interface AxiomOSOptions {
  /** 歴史人物の最大表示数 */
  maxHistorians?: number;
  /** フリー層のみ表示するか */
  freeOnly?: boolean;
  /** 関連公理の深さ（1=直接関連, 2=2ホップ） */
  axiomDepth?: number;
  /** 図形・数式表示を含めるか */
  includeVisuals?: boolean;
}

// ─── AxiomOSEngine クラス ────────────────────────────────────────────────────

export class AxiomOSEngine {
  private brancher: AxiomBrancher;
  private dictionary: AxiomDictionary;

  constructor() {
    this.brancher = new AxiomBrancher();
    this.dictionary = getAxiomDictionary();
  }

  /**
   * メイン処理:
   * 質問 + AI回答 → 3軸分岐 + 歴史人物応答 + 関連公理
   *
   * ★ AIへの追加呼び出しは行わない（ローカル処理のみ）
   * ★ 歴史人物のプロンプトは生成するが、実際のAI呼び出しは呼び出し元が行う
   */
  processQuestion(
    question: string,
    aiResponse: string,
    options: AxiomOSOptions = {}
  ): AxiomOSResult {
    const startTime = Date.now();
    const {
      maxHistorians = 3,
      freeOnly = false,
      axiomDepth = 1,
      includeVisuals = true,
    } = options;

    // 1. 既存3軸分岐（axiom-brancherをそのまま使用）
    const branches = this.brancher.branch(question, aiResponse);

    // 2. 歴史人物の推薦
    const recommendedHistorians = freeOnly
      ? getFreeHistorians().slice(0, maxHistorians)
      : recommendHistorians(question, maxHistorians);

    const historianResults: HistorianResponseResult[] = recommendedHistorians.map((h, idx) => ({
      historian: h,
      promptForAI: h.promptTemplate(question, aiResponse.slice(0, 200)),
      recommendScore: 1.0 - idx * 0.15, // 推薦順にスコアを下げる
    }));

    // 3. 関連公理の検索
    const axiomResults = this.dictionary.recommendForQuestion(question, 5);
    let relatedAxioms = axiomResults.map(r => r.entry);

    // 図形・数式を含めない場合は除去
    if (!includeVisuals) {
      relatedAxioms = relatedAxioms.map(a => ({
        ...a,
        formula: undefined,
        diagram: undefined,
      }));
    }

    // フリー層のみの場合はフィルタ
    if (freeOnly) {
      relatedAxioms = relatedAxioms.filter(a => a.isFree);
    }

    // 4. 対立視点ペアの検索
    const contrastingPair = this.findContrastingPair(recommendedHistorians);

    // 5. 有料コンテンツ含有チェック
    const isPremiumContent =
      historianResults.some(r => !r.historian.isFree) ||
      relatedAxioms.some(a => !a.isFree);

    return {
      originalResponse: aiResponse,
      branches,
      historians: historianResults,
      relatedAxioms: relatedAxioms.slice(0, axiomDepth === 1 ? 3 : 5),
      contrastingPair: contrastingPair || undefined,
      meta: {
        questionType: branches.meta.questionType,
        historianCount: historianResults.length,
        relatedAxiomCount: relatedAxioms.length,
        processingMs: Date.now() - startTime,
        isPremiumContent,
      },
    };
  }

  /**
   * 単一の歴史人物に対するプロンプトを生成
   * （実際のAI呼び出しは aios-engine 側で行う）
   */
  generateHistorianPrompt(
    historianId: string,
    question: string,
    context = ''
  ): string | null {
    const historian = getHistorianById(historianId);
    if (!historian) return null;
    return historian.promptTemplate(question, context);
  }

  /**
   * 公理辞書の検索
   */
  searchDictionary(query: string, freeOnly = false) {
    return this.dictionary.search(query, { freeOnly });
  }

  /**
   * 特定の公理エントリを取得（図形・数式含む）
   */
  getAxiomEntry(axiomId: string): AxiomEntry | undefined {
    return this.dictionary.getById(axiomId);
  }

  /**
   * フリー層コンテンツの一覧（オンボーディング用）
   */
  getFreeContent(): { historians: HistorianPersona[]; axioms: AxiomEntry[] } {
    return {
      historians: getFreeHistorians(),
      axioms: this.dictionary.getFreeEntries(),
    };
  }

  /**
   * 辞書の統計情報
   */
  getDictionaryStats() {
    return this.dictionary.getStats();
  }

  // ── プライベート ────────────────────────────────────────────────────────

  private findContrastingPair(
    historians: HistorianPersona[]
  ): ContrastingPairResult | null {
    const ids = historians.map(h => h.id);

    for (const pair of CONTRASTING_PAIRS) {
      if (ids.includes(pair.ids[0]) && ids.includes(pair.ids[1])) {
        const hA = getHistorianById(pair.ids[0]);
        const hB = getHistorianById(pair.ids[1]);
        if (hA && hB) {
          return { historianA: hA, historianB: hB, theme: pair.theme };
        }
      }
    }
    return null;
  }
}

// ─── シングルトンインスタンス ────────────────────────────────────────────────

let _engineInstance: AxiomOSEngine | null = null;

export function getAxiomOSEngine(): AxiomOSEngine {
  if (!_engineInstance) {
    _engineInstance = new AxiomOSEngine();
  }
  return _engineInstance;
}

// ─── 使用例（コメント） ──────────────────────────────────────────────────────
/*
使用例（aios-engine.ts や assistant.html から呼び出す）:

import { getAxiomOSEngine } from './axiom-os-engine';

const engine = getAxiomOSEngine();

// AI回答を1回取得後、ローカルで公理OS処理
const aiResponse = await llmAdapter.complete({ messages: [...] });
const result = engine.processQuestion(userQuestion, aiResponse.content, {
  maxHistorians: 3,
  freeOnly: false,  // 有料ユーザーはfalse、無料ユーザーはtrue
  includeVisuals: true,
});

// 3軸分岐（既存機能）
console.log(result.branches.branches);

// 歴史人物プロンプト（必要なら再度AI呼び出し）
for (const h of result.historians) {
  console.log(`${h.historian.nameJa}:`, h.promptForAI);
  // 必要なら: const historianResp = await llmAdapter.complete(h.promptForAI);
}

// 関連公理（辞書から）
for (const axiom of result.relatedAxioms) {
  console.log(axiom.nameJa, axiom.coreDefinition);
  if (axiom.formula) console.log(axiom.formula.latex);
  if (axiom.diagram) console.log(axiom.diagram.ascii);
}

// 対立視点
if (result.contrastingPair) {
  console.log(`対立テーマ: ${result.contrastingPair.theme}`);
}
*/
