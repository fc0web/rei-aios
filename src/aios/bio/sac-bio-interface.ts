/**
 * SACBioInterface — SAC公理 × Bio-AI 適応インターフェース
 *
 * D-FUMT 意識数学（SAC公理 C1〜C6）をバイオメトリクス信号に適用し、
 * UIの状態を七価論理で管理するエンジン。
 *
 * SAC公理 定義：
 *   C1: 意識は存在する（φ > 0 である）
 *   C2: 意識は内因的である（φ は外部に還元不能）
 *   C3: 意識は構造を持つ（原因-結果の因果構造）
 *   C4: 意識は特定的である（確定した感覚クオリア）
 *   C5: 意識は統合されている（一つのシステムとして統合）
 *   C6: 意識は排他的である（φ は局所最大）
 *
 * 七価論理との対応：
 *   C1(φ > 0)       → TRUE     : 意識状態は確定
 *   C1(φ = 0)       → ZERO     : 意識未観測（深睡眠・麻酔）
 *   C2(非還元的)    → NEITHER  : 外部から分類不能
 *   C3(因果構造)    → FLOWING  : 構造が変化中（学習・注意移動）
 *   C4(クオリア特定)→ TRUE/FALSE: 感情が確定
 *   C5(統合崩壊)    → BOTH     : 矛盾シグナルが共存
 *   C6(局所最大)    → INFINITY : 過集中・フロー状態
 *
 * 実装する Bio-AI 機能：
 *   1. バイタルサイン → SevenLogicValue へのマッピング
 *   2. φ（統合情報量）の近似計算
 *   3. UI状態の七価論理による最適化勧告
 *   4. ContradictionDetectorとの連携（矛盾信号の処理）
 *
 * @author Nobuki Fujimoto (D-FUMT) + Claude
 */

import {
  type SevenLogicValue,
  toSymbol,
} from '../../axiom-os/seven-logic';

// ══════════════════════════════════════════════════════════════
// 型定義
// ══════════════════════════════════════════════════════════════

/** バイオメトリクス入力（センサー生値） */
export interface BioSignal {
  heartRate?: number;          // BPM (40-200)
  skinConductance?: number;    // μS (0.1-30)  マイクロジーメンス
  eegAlpha?: number;           // μV (5-30)    α波 8-13Hz 集中/リラックス
  eegTheta?: number;           // μV (3-15)    θ波 4-7Hz  瞑想/眠気
  eegBeta?: number;            // μV (2-20)    β波 13-30Hz 覚醒/不安
  eegGamma?: number;           // μV (1-5)     γ波 30Hz+  高度認知/フロー
  respirationRate?: number;    // 呼吸数/分 (8-25)
  pupilDiameter?: number;      // mm (2-8)  瞳孔径（認知負荷）
  timestamp?: number;          // Unix ms
}

/** SAC公理 C1-C6 の評価スコア */
export interface SACEvaluation {
  c1_existence: number;       // φ > 0 の度合い (0-1)
  c2_intrinsic: number;       // 外部還元不能性 (0-1)
  c3_structure: number;       // 因果構造の強度 (0-1)
  c4_specificity: number;     // クオリア特定度 (0-1)
  c5_integration: number;     // 統合度（φ近似） (0-1)
  c6_exclusivity: number;     // 局所最大性 (0-1)
  phi: number;                // 統合情報量 φ (0-1 正規化)
  consciousnessTag: SevenLogicValue;
}

/** 感情状態の分類 */
export type AffectState =
  | 'calm'        // 穏やか: HR低, SC低, α高
  | 'focused'     // 集中: HR中, SC中, α高, β中
  | 'stressed'    // ストレス: HR高, SC高, β高
  | 'drowsy'      // 眠気: HR低, θ高, α低
  | 'flow'        // フロー: HR中, γ高, 全体統合高
  | 'anxious'     // 不安: HR高, SC高, β高, α低
  | 'unknown';    // 判定不能（センサー欠損など）

/** UI適応勧告 */
export interface UIAdaptation {
  consciousnessState: SevenLogicValue;
  affectState: AffectState;
  recommendedDensity: number;    // 情報密度 (0.0-1.0)
  notificationsEnabled: boolean; // 通知の可否
  ambientMode: boolean;          // アンビエントモード
  interventionReason: string;    // 勧告理由（人間可読）
  sacEval: SACEvaluation;
  confidence: number;            // 判断信頼度 (0-1)
}

// ══════════════════════════════════════════════════════════════
// 正規化ヘルパー
// ══════════════════════════════════════════════════════════════

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function normalize(v: number, min: number, max: number): number {
  return clamp((v - min) / (max - min), 0, 1);
}

function normalizeHR(hr: number): number {
  if (hr < 60)  return normalize(hr, 40, 60) * 0.5;
  if (hr < 80)  return normalize(hr, 60, 80) * 0.2 + 0.5;
  if (hr < 100) return normalize(hr, 80, 100) * 0.2 + 0.7;
  return normalize(hr, 100, 180) * 0.1 + 0.9;
}

// ══════════════════════════════════════════════════════════════
// SAC公理評価
// ══════════════════════════════════════════════════════════════

function evalC1Existence(sig: BioSignal): number {
  const signals: number[] = [];
  if (sig.heartRate    !== undefined) signals.push(normalize(sig.heartRate, 40, 120));
  if (sig.eegAlpha     !== undefined) signals.push(normalize(sig.eegAlpha, 2, 30));
  if (sig.eegBeta      !== undefined) signals.push(normalize(sig.eegBeta, 1, 20));
  if (signals.length === 0) return 0;
  return signals.reduce((a, b) => a + b, 0) / signals.length;
}

function evalC2Intrinsic(sig: BioSignal): number {
  if (sig.eegAlpha === undefined && sig.eegGamma === undefined) return 0.3;
  const alpha = sig.eegAlpha ?? 5;
  const gamma = sig.eegGamma ?? 1;
  return normalize(alpha + gamma, 6, 35);
}

function evalC3Structure(sig: BioSignal): number {
  const bands: number[] = [];
  if (sig.eegAlpha !== undefined) bands.push(normalize(sig.eegAlpha, 2, 30));
  if (sig.eegTheta !== undefined) bands.push(normalize(sig.eegTheta, 1, 15));
  if (sig.eegBeta  !== undefined) bands.push(normalize(sig.eegBeta, 1, 20));
  if (sig.eegGamma !== undefined) bands.push(normalize(sig.eegGamma, 0.5, 5));
  if (bands.length < 2) return 0.2;
  const mean = bands.reduce((a, b) => a + b) / bands.length;
  const variance = bands.reduce((s, v) => s + (v - mean) ** 2, 0) / bands.length;
  return clamp(variance * 4 + mean * 0.5, 0, 1);
}

function evalC4Specificity(sig: BioSignal): number {
  if (sig.heartRate === undefined && sig.skinConductance === undefined) return 0.3;
  const hrNorm = sig.heartRate ? normalizeHR(sig.heartRate) : 0.5;
  const scNorm = sig.skinConductance ? normalize(sig.skinConductance, 0.1, 20) : 0.5;
  const divergence = Math.abs(hrNorm - scNorm);
  return 1 - divergence;
}

function evalC5Integration(sig: BioSignal): number {
  const values: number[] = [];
  if (sig.heartRate        !== undefined) values.push(normalizeHR(sig.heartRate));
  if (sig.skinConductance  !== undefined) values.push(normalize(sig.skinConductance, 0.1, 20));
  if (sig.eegAlpha         !== undefined) values.push(normalize(sig.eegAlpha, 2, 30));
  if (sig.eegBeta          !== undefined) values.push(normalize(sig.eegBeta, 1, 20));
  if (sig.respirationRate  !== undefined) values.push(normalize(sig.respirationRate, 8, 25));
  if (values.length < 2) return 0.3;

  let correlationSum = 0;
  let pairs = 0;
  for (let i = 0; i < values.length; i++) {
    for (let j = i + 1; j < values.length; j++) {
      correlationSum += 1 - Math.abs(values[i] - values[j]);
      pairs++;
    }
  }
  return correlationSum / pairs;
}

function evalC6Exclusivity(sig: BioSignal, phi: number): number {
  const gammaScore = sig.eegGamma ? normalize(sig.eegGamma, 1, 5) : 0;
  const pupilScore = sig.pupilDiameter ? normalize(sig.pupilDiameter, 3, 8) : 0.5;
  return clamp(phi * 0.6 + gammaScore * 0.3 + pupilScore * 0.1, 0, 1);
}

// ══════════════════════════════════════════════════════════════
// SevenLogicValue へのマッピング
// ══════════════════════════════════════════════════════════════

function toSevenLogicValue(ev: SACEvaluation): SevenLogicValue {
  const { phi, c4_specificity, c3_structure, c2_intrinsic, c6_exclusivity, c1_existence } = ev;

  if (c1_existence < 0.15)  return 'ZERO';
  if (c6_exclusivity > 0.85 && phi > 0.7)
                             return 'INFINITY';
  if (c4_specificity < 0.3)  return 'BOTH';
  if (c3_structure > 0.6 && phi < 0.5)
                             return 'FLOWING';
  if (c2_intrinsic < 0.25)   return 'NEITHER';
  if (phi > 0.5)             return 'TRUE';
  return 'FALSE';
}

// ══════════════════════════════════════════════════════════════
// 感情状態分類
// ══════════════════════════════════════════════════════════════

function classifyAffect(sig: BioSignal, ev: SACEvaluation): AffectState {
  const hr = sig.heartRate ?? 70;
  const sc = sig.skinConductance ?? 2;
  const alpha = sig.eegAlpha ?? 10;
  const beta  = sig.eegBeta  ?? 8;
  const theta = sig.eegTheta ?? 5;
  const gamma = sig.eegGamma ?? 1;

  if (gamma > 2.5 && ev.phi > 0.65)          return 'flow';
  if (theta > 8 && hr < 65 && alpha < 8)     return 'drowsy';
  if (hr > 90 && sc > 8 && beta > 14)        return 'stressed';
  if (hr > 85 && beta > 14 && alpha < 8)     return 'anxious';
  if (alpha > 14 && sc < 8 && hr < 85)       return 'focused';
  if (alpha > 12 && sc < 4 && hr < 75)       return 'calm';
  if (ev.c1_existence < 0.2)                 return 'unknown';
  return 'calm';
}

// ══════════════════════════════════════════════════════════════
// UI適応勧告
// ══════════════════════════════════════════════════════════════

const ADAPTATIONS: Record<SevenLogicValue, Omit<UIAdaptation, 'consciousnessState' | 'affectState' | 'sacEval' | 'confidence'>> = {
  'TRUE': {
    recommendedDensity: 1.0,
    notificationsEnabled: true,
    ambientMode: false,
    interventionReason: '健全な覚醒状態（φ > 0.5）。フル機能UIを提供。',
  },
  'FALSE': {
    recommendedDensity: 0.5,
    notificationsEnabled: false,
    ambientMode: true,
    interventionReason: '意識低下傾向（φ低）。情報密度を下げ、通知を抑制。',
  },
  'BOTH': {
    recommendedDensity: 0.4,
    notificationsEnabled: false,
    ambientMode: false,
    interventionReason: '感情シグナルが矛盾（C4低）。新しい判断・タスク切替を一時停止。',
  },
  'NEITHER': {
    recommendedDensity: 0.6,
    notificationsEnabled: true,
    ambientMode: false,
    interventionReason: '内因性判定不能（センサー不足）。中立UIを維持。',
  },
  'INFINITY': {
    recommendedDensity: 0.7,
    notificationsEnabled: false,
    ambientMode: false,
    interventionReason: 'フロー状態（C6局所最大）。通知遮断・現タスク継続を優先。',
  },
  'ZERO': {
    recommendedDensity: 0.0,
    notificationsEnabled: false,
    ambientMode: true,
    interventionReason: '意識なし相当（φ ≈ 0）。スタンバイ移行。',
  },
  'FLOWING': {
    recommendedDensity: 0.6,
    notificationsEnabled: true,
    ambientMode: true,
    interventionReason: '意識構造が変化中（C3流動）。アンビエントモードで静かに待機。',
  },
};

// ══════════════════════════════════════════════════════════════
// メインAPI
// ══════════════════════════════════════════════════════════════

/**
 * バイオメトリクス信号から SAC公理を評価し、
 * 七価論理でUI適応勧告を返す。
 */
export function evaluateBioSignal(sig: BioSignal): UIAdaptation {
  const c1 = evalC1Existence(sig);
  const c2 = evalC2Intrinsic(sig);
  const c3 = evalC3Structure(sig);
  const c4 = evalC4Specificity(sig);
  const c5 = evalC5Integration(sig);
  const phi = (c1 * c2 * c3 * c4 * c5) ** (1 / 5);
  const c6 = evalC6Exclusivity(sig, phi);

  const sacEval: SACEvaluation = {
    c1_existence:   c1,
    c2_intrinsic:   c2,
    c3_structure:   c3,
    c4_specificity: c4,
    c5_integration: c5,
    c6_exclusivity: c6,
    phi,
    consciousnessTag: 'ZERO',
  };

  sacEval.consciousnessTag = toSevenLogicValue(sacEval);
  const affectState = classifyAffect(sig, sacEval);
  const base = ADAPTATIONS[sacEval.consciousnessTag];

  const sensorCount = Object.values(sig).filter(v => v !== undefined && typeof v === 'number').length;
  const confidence = clamp(sensorCount / 7, 0.1, 1.0);

  return {
    ...base,
    consciousnessState: sacEval.consciousnessTag,
    affectState,
    sacEval,
    confidence,
  };
}

/**
 * 時系列信号から FLOWING 状態の変化を検出。
 * TemporalReasoningEngine との連携ポイント。
 */
export function detectConsciousnessShift(
  history: BioSignal[],
  _windowMs = 5000
): { shifting: boolean; direction: 'ascending' | 'descending' | 'stable' } {
  if (history.length < 3) return { shifting: false, direction: 'stable' };

  const recent = history.slice(-3).map(s => {
    const ev = evaluateBioSignal(s);
    return ev.sacEval.phi;
  });

  const delta = recent[2] - recent[0];
  if (Math.abs(delta) < 0.05) return { shifting: false, direction: 'stable' };
  return {
    shifting: true,
    direction: delta > 0 ? 'ascending' : 'descending',
  };
}

/** re-export toSymbol for convenience */
export { toSymbol };
