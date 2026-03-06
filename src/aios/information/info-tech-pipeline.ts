/**
 * Rei-AIOS Phase 7d — Rei情報技術パイプライン
 * Theory #80: パイプライン演算子|>が情報変換の普遍演算
 *
 * 収集→分析→分類→圧縮→格納→応答の6段階パイプライン
 *
 * @author Nobuki Fujimoto (D-FUMT) + Claude
 */

import { calcDFUMTEntropy, DFUMTProbDist } from './dfumt-entropy';
import { analyzePatterns } from './pattern-analyzer';
import { decomposeInfo } from './decomp-structure';
import { CAVE_SYMBOLS_32 } from './ancient-code-mapper';

// --- 型定義 ---

export interface PipelineStage {
  name: string;
  description: string;
  dfumtValue: string;
  ancientAnalogy: string;
}

export interface PipelineResult {
  input: string;
  stages: Array<{
    stage: PipelineStage;
    output: unknown;
    processingMs: number;
  }>;
  finalOutput: InfoPipelineOutput;
  totalMs: number;
  theoryRef: 80;
}

export interface InfoPipelineOutput {
  entropy: { h7: number; dominantValue: string };
  patterns: { commonalityScore: number; summary: string };
  decomposition: { coreRatio: number; reiReduction: number };
  ancientCodeMatch: string[];
  dfumtSummary: string;
}

// --- 6段階パイプライン定義 ---

export const PIPELINE_STAGES: PipelineStage[] = [
  {
    name: '収集（Gather）',
    description: '生の情報を取り込む。rei-extract CLIの役割。',
    dfumtValue: '～（保留・重ね合わせ）——未処理の可能性の束',
    ancientAnalogy: '壁画への最初の点描——情報の記録開始',
  },
  {
    name: '分析（Analyze）',
    description: 'D-FUMTエントロピーとパターン分析を適用する。',
    dfumtValue: '∞（無限進行）——全パターンを同時評価',
    ancientAnalogy: '易経による卦の占い——状態の多角的評価',
  },
  {
    name: '分類（Classify）',
    description: '32符号・64卦・七値論理へのマッピング。',
    dfumtValue: '⊤/⊥/Both/Neither——分類の確定',
    ancientAnalogy: 'フォン・ペッツィンガーの32符号分類——共通パターンの特定',
  },
  {
    name: '圧縮（Compress）',
    description: 'RCT（Rei圧縮理論 Theory #67）による圧縮。',
    dfumtValue: '〇（ゼロ収束）——本質への凝縮',
    ancientAnalogy: '地底人の深度圧縮——深いほど本質・密度が高まる',
  },
  {
    name: '格納（Store）',
    description: 'Axiom OS SQLiteへの保存。Theory #76-#80を関連付け。',
    dfumtValue: '⊤（完全完了）——知識の永続化',
    ancientAnalogy: '洞窟壁画への刻み込み——3万年の情報保存',
  },
  {
    name: '応答（Respond）',
    description: '異文明知性ペルソナによる解釈と出力。',
    dfumtValue: '～（FLOWING）——情報の流動的出力',
    ancientAnalogy: '超古代人ペルソナによる円環的応答',
  },
];

// --- パイプライン実行 ---

/**
 * 情報技術パイプラインを実行する
 * Reiの |> 演算子の概念的実装
 */
export async function runInfoPipeline(input: string): Promise<PipelineResult> {
  const startTotal = Date.now();
  const stages: PipelineResult['stages'] = [];

  // Stage 1: 収集
  const s1Start = Date.now();
  const gathered = { raw: input, length: input.length, timestamp: new Date() };
  stages.push({ stage: PIPELINE_STAGES[0], output: gathered, processingMs: Date.now() - s1Start });

  // Stage 2: 分析
  const s2Start = Date.now();
  const words = input.split(/\s+/);
  const dist: DFUMTProbDist = {
    '\u22a4': words.filter(w => /真|完了|成功|yes|true/i.test(w)).length + 0.1,
    '\u22a5': words.filter(w => /偽|失敗|no|false/i.test(w)).length + 0.1,
    'Both': words.filter(w => /両|both|矛盾|複合/i.test(w)).length + 0.05,
    'Neither': words.filter(w => /超越|neither|定義不能/i.test(w)).length + 0.05,
    '\u221e': words.filter(w => /無限|infinity|続く|進行/i.test(w)).length + 0.1,
    '\u3007': words.filter(w => /ゼロ|空|zero|消滅/i.test(w)).length + 0.05,
    '\uff5e': words.filter(w => /保留|pending|流れ|波/i.test(w)).length + 0.1,
  };
  const entropy = calcDFUMTEntropy(dist);
  stages.push({ stage: PIPELINE_STAGES[1], output: entropy, processingMs: Date.now() - s2Start });

  // Stage 3: 分類
  const s3Start = Date.now();
  const patterns = analyzePatterns();
  const ancientMatches = CAVE_SYMBOLS_32
    .filter(s => input.includes(s.name) || input.includes(s.shape))
    .map(s => `${s.shape}（${s.name}: ${s.interpretation}）`);
  stages.push({ stage: PIPELINE_STAGES[2], output: { patterns, ancientMatches }, processingMs: Date.now() - s3Start });

  // Stage 4: 圧縮（分解構造理論）
  const s4Start = Date.now();
  const decomp = decomposeInfo(input);
  stages.push({ stage: PIPELINE_STAGES[3], output: decomp, processingMs: Date.now() - s4Start });

  // Stage 5: 格納（シミュレーション）
  const s5Start = Date.now();
  const stored = { id: `info-${Date.now()}`, theories: [76, 77, 78, 79, 80], timestamp: new Date() };
  stages.push({ stage: PIPELINE_STAGES[4], output: stored, processingMs: Date.now() - s5Start });

  // Stage 6: 応答生成
  const s6Start = Date.now();
  const dfumtSummary = `
入力情報のD-FUMT分析:
  エントロピー H₇ = ${entropy.h7.toFixed(3)}（支配的状態: ${entropy.dominantValue}）
  普遍パターン共通性 = ${(patterns.commonalityScore * 100).toFixed(0)}%（2ⁿ構造族）
  Rei圧縮予測 = ${(decomp.reiReduction * 100).toFixed(0)}%削減可能
  超古代符号対応: ${ancientMatches.length > 0 ? ancientMatches.join('、') : 'なし'}
  `.trim();
  stages.push({ stage: PIPELINE_STAGES[5], output: dfumtSummary, processingMs: Date.now() - s6Start });

  const finalOutput: InfoPipelineOutput = {
    entropy: { h7: entropy.h7, dominantValue: entropy.dominantValue },
    patterns: { commonalityScore: patterns.commonalityScore, summary: patterns.articleSummary },
    decomposition: { coreRatio: 0.5, reiReduction: decomp.reiReduction },
    ancientCodeMatch: ancientMatches,
    dfumtSummary,
  };

  return {
    input,
    stages,
    finalOutput,
    totalMs: Date.now() - startTotal,
    theoryRef: 80,
  };
}

/**
 * Rei-PL構文でのパイプライン表現を生成する
 */
export function generateReiPipelineSyntax(taskName: string): string {
  return `
-- Theory #80: Rei情報技術統合パイプライン
-- ${taskName}
task ${taskName.toLowerCase().replace(/\s+/g, '_')}
  persona: SUBTERRANEAN
  depth: 7
  execute:
    raw_input
      |> gather_info           -- Stage 1: 収集（～保留）
      |> dfumt_entropy_calc    -- Stage 2: 分析（∞進行）
      |> ancient_code_classify -- Stage 3: 分類（⊤/⊥確定）
      |> rct_compress          -- Stage 4: 圧縮（〇収束）
      |> axiom_os_store        -- Stage 5: 格納（⊤完了）
      |> persona_respond       -- Stage 6: 応答（～FLOWING）
  `.trim();
}
