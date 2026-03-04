/**
 * CognitiveLoadMeter — AI推論の認知負荷計測エンジン
 *
 * 設計思想（「自然言語と数式」論文 §4より）：
 *   「数学は構造を掘るが、自分自身の目的・価値を決定できない。
 *    認知負荷とは、推論が自己目的化した時に生じる過負荷である。」
 *
 * 七価論理による負荷表現：
 *   〇（ZERO）    = 負荷なし（未開始）
 *   ⊤（TRUE）    = 適正負荷（最適）
 *   ～（FLOWING） = 増加中（注意）
 *   ⊥（FALSE）   = 軽すぎる（過小）
 *   ∞（INFINITY）= 過負荷（処理不能）
 *   B（BOTH）    = 矛盾する負荷（再設計必要）
 *   N（NEITHER） = 負荷評価不能
 *
 * 計測対象：
 *   1. 推論深度（ネスト・再帰の深さ）
 *   2. 公理参照数（使用した公理の数）
 *   3. 七価論理値の多様性（値の種類が多いほど複雑）
 *   4. 矛盾密度（BOTHの割合）
 *   5. 未解決率（FLOWINGの割合）
 */

import { type SevenLogicValue, toSymbol } from './seven-logic';

// ── 計測スナップショット ──

export interface LoadSnapshot {
  id: string;
  timestamp: number;
  depth: number;                    // 推論深度
  axiomCount: number;               // 参照公理数
  valueVariety: number;             // 七価値の多様性（0〜7）
  contradictionRate: number;        // 矛盾密度（0.0〜1.0）
  unresolvedRate: number;           // 未解決率（0.0〜1.0）
  loadValue: SevenLogicValue;       // 七価論理での負荷評価
  rawScore: number;                 // 数値スコア（0〜100）
  context?: string;                 // 計測コンテキスト
}

// ── 負荷アラート ──

export type LoadAlert =
  | 'overload'         // 過負荷: rawScore > 80
  | 'approaching'      // 過負荷接近: rawScore > 60
  | 'optimal'          // 最適: rawScore 20〜60
  | 'underload'        // 過小: rawScore < 20
  | 'contradiction'    // 矛盾密度高: contradictionRate > 0.5
  | 'stuck';           // 未解決率高: unresolvedRate > 0.7

// ── セッション統計 ──

export interface LoadSession {
  id: string;
  snapshots: LoadSnapshot[];
  peakLoad: SevenLogicValue;
  averageScore: number;
  alerts: Array<{ alert: LoadAlert; at: number }>;
}

// ── CognitiveLoadMeter 本体 ──

export class CognitiveLoadMeter {
  private sessions: Map<string, LoadSession> = new Map();
  private snapCounter = 0;
  private sessionCounter = 0;

  /** 新しい計測セッションを開始 */
  startSession(context?: string): string {
    const id = `load-session-${++this.sessionCounter}`;
    this.sessions.set(id, {
      id, snapshots: [], peakLoad: 'ZERO', averageScore: 0, alerts: [],
    });
    return id;
  }

  /**
   * 推論状態を計測してスナップショットを記録する
   */
  measure(
    sessionId: string,
    params: {
      depth: number;
      axiomCount: number;
      logicValues: SevenLogicValue[];  // 現在の推論で使用した七価値一覧
      context?: string;
    },
  ): LoadSnapshot | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const contradictions = params.logicValues.filter(v => v === 'BOTH').length;
    const unresolved     = params.logicValues.filter(v => v === 'FLOWING' || v === 'INFINITY').length;
    const total = params.logicValues.length || 1;

    const valueVariety   = new Set(params.logicValues).size;
    const contradictionRate = contradictions / total;
    const unresolvedRate    = unresolved / total;

    const rawScore = this.calcRawScore({
      depth: params.depth,
      axiomCount: params.axiomCount,
      valueVariety,
      contradictionRate,
      unresolvedRate,
    });

    const loadValue = this.scoreToLogic(rawScore, contradictionRate, unresolvedRate);

    const snap: LoadSnapshot = {
      id: `snap-${++this.snapCounter}`,
      timestamp: Date.now(),
      depth: params.depth,
      axiomCount: params.axiomCount,
      valueVariety,
      contradictionRate,
      unresolvedRate,
      loadValue,
      rawScore,
      context: params.context,
    };

    session.snapshots.push(snap);
    this.updateSession(session, snap);
    return snap;
  }

  /**
   * 現在の負荷に基づいてアラートを返す
   */
  getAlerts(sessionId: string): LoadAlert[] {
    const session = this.sessions.get(sessionId);
    if (!session || session.snapshots.length === 0) return [];

    const latest = session.snapshots[session.snapshots.length - 1];
    const alerts: LoadAlert[] = [];

    if (latest.rawScore > 80)              alerts.push('overload');
    else if (latest.rawScore > 60)         alerts.push('approaching');
    else if (latest.rawScore < 20)         alerts.push('underload');
    else                                   alerts.push('optimal');

    if (latest.contradictionRate > 0.5)   alerts.push('contradiction');
    if (latest.unresolvedRate > 0.7)       alerts.push('stuck');

    return alerts;
  }

  /**
   * 負荷軽減の推奨アクションを返す
   */
  recommend(sessionId: string): string[] {
    const alerts = this.getAlerts(sessionId);
    const recs: string[] = [];

    if (alerts.includes('overload')) {
      recs.push('推論を分割して小さなサブタスクに分解してください');
      recs.push('公理参照数を削減してください（上位3理論に絞る）');
    }
    if (alerts.includes('contradiction')) {
      recs.push('ContradictionDetectorでΩ収束を実行してください');
      recs.push('矛盾する公理ペアを特定して優先度を設定してください');
    }
    if (alerts.includes('stuck')) {
      recs.push('FLOWINGの未解決値に追加情報を投入してください');
      recs.push('TemporalReasoningEngineで時間軸を整理してください');
    }
    if (alerts.includes('underload')) {
      recs.push('より深い推論が可能です。公理チェーンを拡張してください');
    }
    if (alerts.includes('optimal')) {
      recs.push('推論負荷は最適状態です');
    }
    return recs;
  }

  /**
   * セッション統計を取得する
   */
  getSession(sessionId: string): LoadSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * 全セッションのサマリー
   */
  summarize(): {
    totalSessions: number;
    totalSnapshots: number;
    overloadCount: number;
    optimalCount: number;
  } {
    let totalSnaps = 0, overloads = 0, optimals = 0;
    for (const session of this.sessions.values()) {
      totalSnaps += session.snapshots.length;
      for (const snap of session.snapshots) {
        if (snap.rawScore > 80)                    overloads++;
        else if (snap.rawScore >= 20 && snap.rawScore <= 60) optimals++;
      }
    }
    return {
      totalSessions: this.sessions.size,
      totalSnapshots: totalSnaps,
      overloadCount: overloads,
      optimalCount: optimals,
    };
  }

  // ── プライベートメソッド ──

  private calcRawScore(params: {
    depth: number;
    axiomCount: number;
    valueVariety: number;
    contradictionRate: number;
    unresolvedRate: number;
  }): number {
    // 各要素を0〜100にスケーリングして加重平均
    const depthScore        = Math.min(params.depth * 10, 40);      // 深度: 最大40点
    const axiomScore        = Math.min(params.axiomCount * 3, 20);  // 公理数: 最大20点
    const varietyScore      = params.valueVariety * 3;              // 多様性: 最大21点
    const contradictionScore= params.contradictionRate * 25;        // 矛盾: 最大25点
    const unresolvedScore   = params.unresolvedRate * 15;           // 未解決: 最大15点

    return Math.min(
      depthScore + axiomScore + varietyScore + contradictionScore + unresolvedScore,
      100
    );
  }

  private scoreToLogic(
    score: number,
    contradictionRate: number,
    unresolvedRate: number,
  ): SevenLogicValue {
    if (contradictionRate > 0.5) return 'BOTH';      // 矛盾多 → BOTH
    if (score > 80)              return 'INFINITY';  // 過負荷 → ∞
    if (score > 60)              return 'FLOWING';   // 増加中 → ～
    if (score >= 20)             return 'TRUE';      // 最適 → ⊤
    if (unresolvedRate > 0.7)    return 'NEITHER';   // 評価不能 → N
    return 'FALSE';                                   // 過小 → ⊥
  }

  private updateSession(session: LoadSession, snap: LoadSnapshot): void {
    // ピーク負荷を更新（rawScore で比較）
    const currentPeak = session.snapshots
      .map(s => s.rawScore)
      .reduce((a, b) => Math.max(a, b), 0);
    session.peakLoad = this.scoreToLogic(currentPeak, 0, 0);

    // 平均スコア更新
    session.averageScore = session.snapshots
      .reduce((sum, s) => sum + s.rawScore, 0) / session.snapshots.length;

    // アラート記録
    if (snap.rawScore > 80) {
      session.alerts.push({ alert: 'overload', at: snap.timestamp });
    }
  }
}
