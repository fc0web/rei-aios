/**
 * ReiAIOSRuntimeBus — モジュール間イベントバス
 *
 * Rei-AIOSの全モジュールを「血管」として繋ぐ中央ディスパッチャ。
 *
 * D-FUMTの縁起論（dependent origination）に基づき、
 * 各モジュールは「イベントの相互依存によって生起するもの」として設計。
 *
 * イベント種別と自動ルーティング:
 *   bio_signal     → SAC評価 → ContradictionDetector + CognitiveLoadMeter
 *   space_snapshot → TemporalReasoningEngine + ExplainabilityEngine
 *   axiom_used     → TheoryEvolution.recordUsage + ExplainabilityEngine
 *   inference      → CognitiveLoadMeter + ExplainabilityEngine
 *   contradiction  → TheoryEvolution（矛盾から新理論を帰納）
 *   ui_feedback    → ContradictionDetector.resolve（ユーザー解決）
 *
 * @author Nobuki Fujimoto (D-FUMT) + Claude
 */

import { ContradictionDetector }    from '../axiom-os/contradiction-detector';
import { CognitiveLoadMeter }        from '../axiom-os/cognitive-load-meter';
import { TemporalReasoningEngine }   from '../axiom-os/temporal-reasoning';
import { ExplainabilityEngine }      from '../axiom-os/explainability-engine';
import { TheoryEvolution }           from '../axiom-os/theory-evolution';
import { type SevenLogicValue, toSymbol } from '../axiom-os/seven-logic';

// ══════════════════════════════════════════════════════════════
// イベント型定義
// ══════════════════════════════════════════════════════════════

export interface BioSignalEvent {
  type: 'bio_signal';
  payload: {
    heartRate?: number;
    skinConductance?: number;
    eegAlpha?: number;
    eegTheta?: number;
    eegBeta?: number;
    eegGamma?: number;
    respirationRate?: number;
    pupilDiameter?: number;
  };
  source: string;
  timestamp: number;
}

export interface SpaceSnapshotEvent {
  type: 'space_snapshot';
  payload: {
    spaceName: string;
    overallTag: SevenLogicValue;
    phi: number;
    dimensions: Array<{ name: string; value: number | null; logicTag: SevenLogicValue }>;
  };
  source: string;
  timestamp: number;
}

export interface AxiomUsedEvent {
  type: 'axiom_used';
  payload: {
    axiomId: string;
    context?: string;
    inputTag: SevenLogicValue;
    outputTag: SevenLogicValue;
  };
  source: string;
  timestamp: number;
}

export interface InferenceEvent {
  type: 'inference';
  payload: {
    question: string;
    depth: number;
    axiomIds: string[];
    logicValues: SevenLogicValue[];
    result: SevenLogicValue;
  };
  source: string;
  timestamp: number;
}

export interface UIFeedbackEvent {
  type: 'ui_feedback';
  payload: {
    contradictionId: string;
    resolution: SevenLogicValue;
    reason?: string;
  };
  source: string;
  timestamp: number;
}

export interface LayerResultEvent {
  type: 'layer_result';
  payload: {
    layerName: string;
    overallStatus: SevenLogicValue;
    stages: Array<{ name: string; inputTag: SevenLogicValue; outputTag: SevenLogicValue }>;
    totalDurationMs: number;
  };
  source: string;
  timestamp: number;
}

export type BusEvent =
  | BioSignalEvent
  | SpaceSnapshotEvent
  | AxiomUsedEvent
  | InferenceEvent
  | UIFeedbackEvent
  | LayerResultEvent;

export type BusEventType = BusEvent['type'];

// ══════════════════════════════════════════════════════════════
// バスが出力するシステムイベント（下流リスナー向け）
// ══════════════════════════════════════════════════════════════

export interface BusOutput {
  timestamp: number;
  eventId: string;
  triggerType: BusEventType;
  source: string;

  contradiction?: {
    id: string;
    kind: string;
    description: string;
    lhsTag: SevenLogicValue;
    rhsTag: SevenLogicValue;
    resultTag: SevenLogicValue;
  };

  cognitiveLoad?: {
    loadValue: SevenLogicValue;
    rawScore: number;
    alerts: string[];
  };

  temporal?: {
    topic: string;
    axis: 'past' | 'now' | 'future';
    value: SevenLogicValue;
  };

  evolvedTheory?: {
    id: string;
    axiom: string;
    parentIds: string[];
    confidence: SevenLogicValue;
  };

  systemTag: SevenLogicValue;
}

// ══════════════════════════════════════════════════════════════
// ReiAIOSRuntimeBus 本体
// ══════════════════════════════════════════════════════════════

export class ReiAIOSRuntimeBus {

  private readonly contradiction: ContradictionDetector;
  private readonly loadMeter: CognitiveLoadMeter;
  private readonly temporal: TemporalReasoningEngine;
  private readonly explainability: ExplainabilityEngine;
  private readonly evolution: TheoryEvolution;

  private loadSessionId: string;
  private currentChainId: string | null = null;
  private eventCounter = 0;

  /** topic → trackId マッピング（TemporalReasoningEngine用） */
  private readonly trackIds: Map<string, string> = new Map();

  private readonly subscribers: Map<string, Array<(output: BusOutput) => void>> = new Map();
  private systemTag: SevenLogicValue = 'ZERO';
  private readonly history: BusOutput[] = [];

  constructor() {
    this.contradiction   = new ContradictionDetector();
    this.loadMeter       = new CognitiveLoadMeter();
    this.temporal        = new TemporalReasoningEngine();
    this.explainability  = new ExplainabilityEngine();
    this.evolution       = new TheoryEvolution();

    this.loadSessionId = this.loadMeter.startSession('rei-aios-runtime');
  }

  // ── TemporalReasoningEngine ヘルパー ──

  /** topicに対応するtrackIdを取得（なければ作成） */
  private getOrCreateTrack(topic: string, initialValue: SevenLogicValue = 'ZERO'): string {
    let trackId = this.trackIds.get(topic);
    if (!trackId) {
      trackId = this.temporal.startTrack(topic, initialValue);
      this.trackIds.set(topic, trackId);
    }
    return trackId;
  }

  // ══════════════════════════════════════════════════════════════
  // パブリッシュ（イベント投入）
  // ══════════════════════════════════════════════════════════════

  publish(event: BusEvent): BusOutput {
    const eventId = `bus-${++this.eventCounter}-${Date.now()}`;
    let output: BusOutput = {
      timestamp: Date.now(),
      eventId,
      triggerType: event.type,
      source: event.source,
      systemTag: this.systemTag,
    };

    switch (event.type) {
      case 'bio_signal':
        output = this.routeBioSignal(event, output);
        break;
      case 'space_snapshot':
        output = this.routeSpaceSnapshot(event, output);
        break;
      case 'axiom_used':
        output = this.routeAxiomUsed(event, output);
        break;
      case 'inference':
        output = this.routeInference(event, output);
        break;
      case 'ui_feedback':
        output = this.routeUIFeedback(event, output);
        break;
      case 'layer_result':
        output = this.routeLayerResult(event, output);
        break;
    }

    this.updateSystemTag(output);
    output.systemTag = this.systemTag;

    this.history.push(output);
    if (this.history.length > 200) this.history.shift();

    this.notify(event.type, output);
    this.notify('*', output);

    return output;
  }

  // ══════════════════════════════════════════════════════════════
  // ルーター群
  // ══════════════════════════════════════════════════════════════

  private routeBioSignal(event: BioSignalEvent, base: BusOutput): BusOutput {
    const sig = event.payload;

    const vals: number[] = [];
    if (sig.heartRate)        vals.push(Math.min(1, sig.heartRate / 100));
    if (sig.eegAlpha)         vals.push(Math.min(1, sig.eegAlpha / 20));
    if (sig.eegBeta)          vals.push(Math.min(1, sig.eegBeta / 16));
    if (sig.skinConductance)  vals.push(Math.min(1, sig.skinConductance / 15));
    const phi = vals.length > 0 ? vals.reduce((a, b) => a + b) / vals.length : 0;

    const hrHigh   = (sig.heartRate ?? 70) > 90;
    const alphaHigh = (sig.eegAlpha ?? 10) > 14;
    const bioTag: SevenLogicValue =
      phi < 0.1                   ? 'ZERO'     :
      hrHigh && alphaHigh         ? 'BOTH'     :
      (sig.eegGamma ?? 0) > 2.5   ? 'INFINITY' :
      phi < 0.3                   ? 'FLOWING'  :
      phi > 0.6                   ? 'TRUE'     :
                                    'FALSE';

    // ContradictionDetector: detect(lhs, rhs, context?)
    let contradictionOut: BusOutput['contradiction'];
    if (bioTag === 'BOTH') {
      const entry = this.contradiction.detect(
        'BOTH',
        'NEITHER',
        { kind: 'value', description: `生体信号の矛盾: 心拍高(${sig.heartRate}bpm) かつ α波高(${sig.eegAlpha}μV)` },
      );
      if (entry) {
        contradictionOut = {
          id: entry.id,
          kind: entry.kind,
          description: entry.description,
          lhsTag: entry.lhs,
          rhsTag: entry.rhs,
          resultTag: entry.result,
        };
      }
      this.evolution.recordUsage('dfumt-catuskoti', `bio_contradiction:${event.source}`);
    }

    // CognitiveLoadMeter
    const loadSnap = this.loadMeter.measure(this.loadSessionId, {
      depth: 1,
      axiomCount: vals.length,
      logicValues: [bioTag],
      context: `bio_signal:${event.source}`,
    });

    const alerts = this.loadMeter.getAlerts(this.loadSessionId);

    // TemporalReasoningEngine
    const trackId = this.getOrCreateTrack(`bio:${event.source}`);
    this.temporal.recordNow(trackId, bioTag, `φ=${phi.toFixed(2)}`);

    if (bioTag === 'INFINITY') {
      this.temporal.recordFuture(trackId, 'FLOWING', `フロー後に流動状態へ移行予測`);
    }

    return {
      ...base,
      contradiction: contradictionOut,
      cognitiveLoad: loadSnap ? {
        loadValue: loadSnap.loadValue,
        rawScore: loadSnap.rawScore,
        alerts: alerts.map(a => typeof a === 'string' ? a : (a as any).alert ?? String(a)),
      } : undefined,
      temporal: {
        topic: `bio:${event.source}`,
        axis: 'now',
        value: bioTag,
      },
    };
  }

  private routeSpaceSnapshot(event: SpaceSnapshotEvent, base: BusOutput): BusOutput {
    const { spaceName, overallTag, phi, dimensions } = event.payload;

    const trackId = this.getOrCreateTrack(`space:${spaceName}`);
    this.temporal.recordNow(trackId, overallTag, `φ=${phi.toFixed(2)} dims=${dimensions.length}`);

    if (overallTag === 'FLOWING') {
      this.temporal.recordFuture(trackId, 'TRUE', '流動状態からの安定化予測');
    }

    // ExplainabilityEngine
    if (!this.currentChainId) {
      this.currentChainId = this.explainability.startChain(`space:${spaceName} の状態観測`);
    }
    this.explainability.recordStep(
      this.currentChainId,
      'dfumt-space-layer',
      'ZERO',
      overallTag,
      `space.snap() → ${spaceName}`,
      `φ=${phi.toFixed(2)}`,
    );

    // 危険状態なら ContradictionDetector
    let contradictionOut: BusOutput['contradiction'];
    if (overallTag === 'INFINITY') {
      const dangerous = dimensions.filter(d => d.logicTag === 'INFINITY');
      const entry = this.contradiction.detect(
        'TRUE',
        'INFINITY',
        { kind: 'value', description: `space [${spaceName}] 危険次元: ${dangerous.map(d => d.name).join(', ')}` },
      );
      if (entry) {
        contradictionOut = {
          id: entry.id,
          kind: entry.kind,
          description: entry.description,
          lhsTag: entry.lhs,
          rhsTag: entry.rhs,
          resultTag: entry.result,
        };
      }
      this.evolution.recordUsage('dfumt-space-layer', `space_danger:${spaceName}`);
    }

    // CognitiveLoadMeter
    const allTags = dimensions.map(d => d.logicTag);
    const loadSnap = this.loadMeter.measure(this.loadSessionId, {
      depth: 2,
      axiomCount: dimensions.length,
      logicValues: [overallTag, ...allTags],
      context: `space:${spaceName}`,
    });

    return {
      ...base,
      contradiction: contradictionOut,
      cognitiveLoad: loadSnap ? {
        loadValue: loadSnap.loadValue,
        rawScore: loadSnap.rawScore,
        alerts: this.loadMeter.getAlerts(this.loadSessionId).map(a => typeof a === 'string' ? a : (a as any).alert ?? String(a)),
      } : undefined,
      temporal: { topic: `space:${spaceName}`, axis: 'now', value: overallTag },
    };
  }

  private routeAxiomUsed(event: AxiomUsedEvent, base: BusOutput): BusOutput {
    const { axiomId, context, inputTag, outputTag } = event.payload;

    this.evolution.recordUsage(axiomId, context);

    let evolvedOut: BusOutput['evolvedTheory'];
    if (this.eventCounter % 5 === 0) {
      const induced = this.evolution.induceFromUsage();
      if (induced) {
        evolvedOut = {
          id: induced.id,
          axiom: induced.axiom,
          parentIds: induced.parentIds,
          confidence: induced.confidence,
        };
      }
    }

    if (this.currentChainId) {
      this.explainability.recordStep(
        this.currentChainId,
        axiomId,
        inputTag,
        outputTag,
        context ?? 'axiom_used',
      );
    }

    return { ...base, evolvedTheory: evolvedOut };
  }

  private routeInference(event: InferenceEvent, base: BusOutput): BusOutput {
    const { question, depth, axiomIds, logicValues, result } = event.payload;

    const chainId = this.explainability.startChain(question);
    this.currentChainId = chainId;

    for (let i = 0; i < axiomIds.length; i++) {
      this.explainability.recordStep(
        chainId,
        axiomIds[i],
        logicValues[i] ?? 'ZERO',
        logicValues[i + 1] ?? result,
        `inference step ${i + 1}`,
      );
      this.evolution.recordUsage(axiomIds[i], `inference:${question.slice(0, 20)}`);
    }

    const loadSnap = this.loadMeter.measure(this.loadSessionId, {
      depth,
      axiomCount: axiomIds.length,
      logicValues: [...logicValues, result],
      context: question,
    });

    const alerts = this.loadMeter.getAlerts(this.loadSessionId);
    const alertStrings = alerts.map(a => typeof a === 'string' ? a : (a as any).alert ?? String(a));

    let contradictionOut: BusOutput['contradiction'];
    if (alertStrings.includes('overload')) {
      const entry = this.contradiction.detect(
        'INFINITY',
        'TRUE',
        { kind: 'logical', description: `推論過負荷: depth=${depth}, axioms=${axiomIds.length}, "${question.slice(0, 30)}..."` },
      );
      if (entry) {
        contradictionOut = {
          id: entry.id,
          kind: entry.kind,
          description: entry.description,
          lhsTag: entry.lhs,
          rhsTag: entry.rhs,
          resultTag: entry.result,
        };
      }
    }

    const trackId = this.getOrCreateTrack(`inference:${chainId}`);
    this.temporal.recordNow(trackId, result, question.slice(0, 40));

    return {
      ...base,
      contradiction: contradictionOut,
      cognitiveLoad: loadSnap ? {
        loadValue: loadSnap.loadValue,
        rawScore: loadSnap.rawScore,
        alerts: alertStrings,
      } : undefined,
      temporal: { topic: `inference:${chainId}`, axis: 'now', value: result },
    };
  }

  private routeUIFeedback(event: UIFeedbackEvent, base: BusOutput): BusOutput {
    const { contradictionId, resolution, reason } = event.payload;

    // resolve(id, strategy) — 実際のAPI
    this.contradiction.resolve(contradictionId, 'omega_convergence');
    this.evolution.recordUsage('dfumt-idempotency', `ui_resolve:${reason ?? ''}`);

    const trackId = this.getOrCreateTrack(`resolution:${contradictionId}`);
    this.temporal.recordNow(trackId, resolution, reason ?? 'ui_feedback');

    return {
      ...base,
      temporal: { topic: `resolution:${contradictionId}`, axis: 'now', value: resolution },
    };
  }

  private routeLayerResult(event: LayerResultEvent, base: BusOutput): BusOutput {
    const { layerName, overallStatus, stages, totalDurationMs } = event.payload;

    const allTags = stages.map(s => s.outputTag);

    const loadSnap = this.loadMeter.measure(this.loadSessionId, {
      depth: stages.length,
      axiomCount: stages.length,
      logicValues: [overallStatus, ...allTags],
      context: `layer:${layerName}`,
    });

    const trackId = this.getOrCreateTrack(`layer:${layerName}`);
    this.temporal.recordNow(
      trackId,
      overallStatus,
      `${stages.length} stages, ${totalDurationMs.toFixed(1)}ms`,
    );

    this.evolution.recordUsage('dfumt-space-layer', `layer_exec:${layerName}`);

    return {
      ...base,
      cognitiveLoad: loadSnap ? {
        loadValue: loadSnap.loadValue,
        rawScore: loadSnap.rawScore,
        alerts: this.loadMeter.getAlerts(this.loadSessionId).map(a => typeof a === 'string' ? a : (a as any).alert ?? String(a)),
      } : undefined,
      temporal: { topic: `layer:${layerName}`, axis: 'now', value: overallStatus },
    };
  }

  // ══════════════════════════════════════════════════════════════
  // システム状態管理
  // ══════════════════════════════════════════════════════════════

  private updateSystemTag(output: BusOutput): void {
    const pending = this.contradiction.getPending().length;
    const load = output.cognitiveLoad?.loadValue ?? 'ZERO';

    if (pending > 5 || output.contradiction?.resultTag === 'INFINITY') {
      this.systemTag = 'INFINITY';
    } else if (pending > 2 || load === 'BOTH') {
      this.systemTag = 'BOTH';
    } else if (load === 'INFINITY') {
      this.systemTag = 'FLOWING';
    } else if (load === 'TRUE') {
      this.systemTag = 'TRUE';
    } else if (this.systemTag === 'ZERO') {
      this.systemTag = 'FLOWING';
    }
  }

  // ══════════════════════════════════════════════════════════════
  // サブスクライブ（イベント購読）
  // ══════════════════════════════════════════════════════════════

  subscribe(
    eventType: BusEventType | '*',
    handler: (output: BusOutput) => void,
  ): () => void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }
    this.subscribers.get(eventType)!.push(handler);
    return () => {
      const list = this.subscribers.get(eventType) ?? [];
      const idx = list.indexOf(handler);
      if (idx >= 0) list.splice(idx, 1);
    };
  }

  private notify(eventType: string, output: BusOutput): void {
    const handlers = this.subscribers.get(eventType) ?? [];
    for (const h of handlers) {
      try { h(output); } catch { /* ハンドラの例外はバスを止めない */ }
    }
  }

  // ══════════════════════════════════════════════════════════════
  // 状態照会API
  // ══════════════════════════════════════════════════════════════

  getSystemTag(): SevenLogicValue { return this.systemTag; }

  getPendingContradictions() { return this.contradiction.getPending(); }

  getLoadAlerts() {
    return this.loadMeter.getAlerts(this.loadSessionId).map(
      a => typeof a === 'string' ? a : (a as any).alert ?? String(a)
    );
  }

  finalizeCurrentChain() {
    if (!this.currentChainId) return null;
    const report = this.explainability.finalize(this.currentChainId);
    this.currentChainId = null;
    return report;
  }

  getEvolvedTheories() { return this.evolution.getEvolved(); }

  getHistory(n = 20): BusOutput[] {
    return this.history.slice(-n);
  }

  summary(): {
    systemTag: SevenLogicValue;
    systemSymbol: string;
    totalEvents: number;
    pendingContradictions: number;
    evolvedTheories: number;
    loadAlerts: string[];
  } {
    return {
      systemTag: this.systemTag,
      systemSymbol: toSymbol(this.systemTag),
      totalEvents: this.eventCounter,
      pendingContradictions: this.getPendingContradictions().length,
      evolvedTheories: this.getEvolvedTheories().length,
      loadAlerts: this.getLoadAlerts(),
    };
  }
}

// ══════════════════════════════════════════════════════════════
// シングルトン（グローバルランタイム）
// ══════════════════════════════════════════════════════════════

let _globalBus: ReiAIOSRuntimeBus | null = null;

export function getReiAIOSRuntime(): ReiAIOSRuntimeBus {
  if (!_globalBus) _globalBus = new ReiAIOSRuntimeBus();
  return _globalBus;
}

export function resetReiAIOSRuntime(): void {
  _globalBus = null;
}
