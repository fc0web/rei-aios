/**
 * TemporalReasoningEngine — 時間軸推論エンジン
 *
 * D-FUMT時相数理（Tₜ理論）の具現化：
 *   - past:   全値 → 〇（過去は未観測に還元）
 *   - now:    恒等（現在はそのまま）
 *   - future: ⊤/⊥ → ～（未来は流動）、both → ∞（矛盾は発散）
 *
 * 条件付き予測推論：
 *   「条件Cが成立すると、状態Sは値Vになる」
 *   条件が FLOWING の間は予測が流動的に変化する
 *
 * 七価論理との対応：
 *   〇 = 未観測（過去に埋もれた事実）
 *   ～ = 流動中（予測・変化中の状態）
 *   ∞ = 評価不能（無限後退・決定不能）
 */

import { type SevenLogicValue, toSymbol, not } from './seven-logic';

// ── 時間軸の値 ──

export type TimeAxis = 'past' | 'now' | 'future';

// ── 時系列スナップショット ──

export interface TemporalSnapshot {
  id: string;
  axis: TimeAxis;
  value: SevenLogicValue;
  timestamp: number;
  label?: string;          // 状態の説明ラベル
  conditionId?: string;    // この状態を引き起こした条件ID
}

// ── 条件付き予測 ──

export interface TemporalPrediction {
  id: string;
  condition: string;           // 条件の自然言語記述
  conditionValue: SevenLogicValue; // 条件の真理値
  targetAxis: TimeAxis;        // 予測対象の時間軸
  predictedValue: SevenLogicValue; // 予測される値
  confidence: SevenLogicValue; // 予測信頼度
  createdAt: number;
  resolvedAt?: number;         // 実際に解決された時刻
  actualValue?: SevenLogicValue; // 実際の値（解決後）
}

// ── 時系列トラック ──

export interface TemporalTrack {
  id: string;
  topic: string;               // 追跡するトピック
  snapshots: TemporalSnapshot[];
  predictions: TemporalPrediction[];
  currentValue: SevenLogicValue;
}

// ── TemporalReasoningEngine 本体 ──

export class TemporalReasoningEngine {
  private readonly tracks: Map<string, TemporalTrack> = new Map();
  private snapCounter = 0;
  private predCounter = 0;
  private trackCounter = 0;

  /** 時系列トラックを開始する */
  startTrack(topic: string, initialValue: SevenLogicValue = 'ZERO'): string {
    const id = `track-${++this.trackCounter}`;
    const track: TemporalTrack = {
      id,
      topic,
      snapshots: [],
      predictions: [],
      currentValue: initialValue,
    };
    this.tracks.set(id, track);

    // 初期スナップショット（now）
    this.recordNow(id, initialValue, `初期状態: ${toSymbol(initialValue)}`);
    return id;
  }

  /**
   * 過去の状態を記録する（past演算子）
   * 全値を〇（未観測）に変換
   */
  recordPast(
    trackId: string,
    value: SevenLogicValue,
    label?: string,
  ): TemporalSnapshot | null {
    return this.addSnapshot(trackId, 'past', this.applyPast(value), label);
  }

  /**
   * 現在の状態を記録する（now演算子）
   * 値をそのまま保持
   */
  recordNow(
    trackId: string,
    value: SevenLogicValue,
    label?: string,
  ): TemporalSnapshot | null {
    const track = this.tracks.get(trackId);
    if (!track) return null;
    track.currentValue = value;
    return this.addSnapshot(trackId, 'now', value, label);
  }

  /**
   * 未来の予測を記録する（future演算子）
   * ⊤/⊥ → ～（流動）、both → ∞（発散）
   */
  recordFuture(
    trackId: string,
    value: SevenLogicValue,
    label?: string,
  ): TemporalSnapshot | null {
    return this.addSnapshot(trackId, 'future', this.applyFuture(value), label);
  }

  /**
   * 条件付き予測を追加する
   * 「条件Cが成立すると未来の値はVになる」
   */
  addPrediction(
    trackId: string,
    condition: string,
    conditionValue: SevenLogicValue,
    predictedValue: SevenLogicValue,
  ): TemporalPrediction | null {
    const track = this.tracks.get(trackId);
    if (!track) return null;

    // 条件が FLOWING の場合は予測も流動的
    const effectivePredicted = conditionValue === 'FLOWING'
      ? this.applyFuture(predictedValue)
      : predictedValue;

    const pred: TemporalPrediction = {
      id: `pred-${++this.predCounter}`,
      condition,
      conditionValue,
      targetAxis: 'future',
      predictedValue: effectivePredicted,
      confidence: this.calcPredictionConfidence(conditionValue),
      createdAt: Date.now(),
    };
    track.predictions.push(pred);
    return pred;
  }

  /**
   * 予測を解決する（実際の値で検証）
   */
  resolvePrediction(
    trackId: string,
    predId: string,
    actualValue: SevenLogicValue,
  ): { correct: boolean; delta: SevenLogicValue } | null {
    const track = this.tracks.get(trackId);
    if (!track) return null;

    const pred = track.predictions.find(p => p.id === predId);
    if (!pred) return null;

    pred.actualValue = actualValue;
    pred.resolvedAt = Date.now();

    // 予測と実際の差分を七価論理で表現
    const correct = pred.predictedValue === actualValue;
    const delta: SevenLogicValue = correct ? 'TRUE'
      : (pred.predictedValue === 'FLOWING' || actualValue === 'FLOWING') ? 'FLOWING'
      : 'BOTH'; // 予測ミス = 矛盾

    return { correct, delta };
  }

  /**
   * トラックの時系列サマリーを返す
   */
  getTimeline(trackId: string): {
    topic: string;
    past: TemporalSnapshot[];
    now: TemporalSnapshot | undefined;
    future: TemporalSnapshot[];
    predictions: TemporalPrediction[];
    currentValue: SevenLogicValue;
    trend: SevenLogicValue;
  } | null {
    const track = this.tracks.get(trackId);
    if (!track) return null;

    const pastSnaps  = track.snapshots.filter(s => s.axis === 'past');
    const nowSnaps   = track.snapshots.filter(s => s.axis === 'now');
    const futureSnaps= track.snapshots.filter(s => s.axis === 'future');

    return {
      topic: track.topic,
      past: pastSnaps,
      now: nowSnaps[nowSnaps.length - 1],
      future: futureSnaps,
      predictions: track.predictions,
      currentValue: track.currentValue,
      trend: this.calcTrend(track),
    };
  }

  /** 全トラックを取得 */
  getAllTracks(): TemporalTrack[] {
    return [...this.tracks.values()];
  }

  /**
   * past演算子の意味論
   * 全値を〇（未観測）に収束
   */
  applyPast(v: SevenLogicValue): SevenLogicValue {
    return 'ZERO'; // past: 全値 → 〇
  }

  /**
   * future演算子の意味論
   * ⊤/⊥ → ～、both → ∞、neither → 〇、∞→∞、〇→～、～→～
   */
  applyFuture(v: SevenLogicValue): SevenLogicValue {
    if (v === 'NEITHER')  return 'ZERO';    // neither → 〇
    if (v === 'BOTH')     return 'INFINITY'; // both → ∞（矛盾は発散）
    if (v === 'INFINITY') return 'INFINITY'; // ∞ → ∞
    if (v === 'ZERO')     return 'FLOWING';  // 〇 → ～
    return 'FLOWING'; // ⊤/⊥/～ → ～
  }

  // ── プライベートメソッド ──

  private addSnapshot(
    trackId: string,
    axis: TimeAxis,
    value: SevenLogicValue,
    label?: string,
  ): TemporalSnapshot | null {
    const track = this.tracks.get(trackId);
    if (!track) return null;

    const snap: TemporalSnapshot = {
      id: `snap-${++this.snapCounter}`,
      axis,
      value,
      timestamp: Date.now(),
      label,
    };
    track.snapshots.push(snap);
    return snap;
  }

  private calcPredictionConfidence(conditionValue: SevenLogicValue): SevenLogicValue {
    if (conditionValue === 'TRUE')     return 'FLOWING'; // 条件確定=予測流動
    if (conditionValue === 'FALSE')    return 'NEITHER'; // 条件偽=予測無記
    if (conditionValue === 'FLOWING')  return 'FLOWING'; // 条件流動=予測流動
    if (conditionValue === 'ZERO')     return 'ZERO';    // 条件未観測=予測未観測
    if (conditionValue === 'BOTH')     return 'BOTH';    // 条件矛盾=予測矛盾
    return 'FLOWING';
  }

  private calcTrend(track: TemporalTrack): SevenLogicValue {
    const recent = track.snapshots.slice(-3);
    if (recent.length === 0) return 'ZERO';
    const values = recent.map(s => s.value);
    // 全て同じ → TRUE（安定）
    if (values.every(v => v === values[0])) return 'TRUE';
    // FLOWING が含まれる → FLOWING
    if (values.includes('FLOWING')) return 'FLOWING';
    // BOTH が含まれる → BOTH
    if (values.includes('BOTH')) return 'BOTH';
    return 'FLOWING';
  }
}
