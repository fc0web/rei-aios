/**
 * ConsensusEngine — 七価論理による分散協調推論・合意形成エンジン
 *
 * 既存 DiscussionEngine（QuadLogic4値）を超えて
 * D-FUMT七価論理（7値）で複数インスタンスの合意を形成する。
 *
 * 合意アルゴリズム:
 *   1. 各インスタンスが独立に七価論理値で回答
 *   2. 七価論理の∧（AND）で全回答を合成
 *   3. BOTH（矛盾）はΩ収束で解決、FLOWING は追加ラウンドへ
 *   4. TRUE/FALSE/NEITHER が合意値として確定
 *
 * Toyosatomi Mode との違い:
 *   - Toyosatomi: 並列比較（どのAIが優れているか）
 *   - ConsensusEngine: 協調合意（全AIが何に同意するか）
 */

import { type SevenLogicValue, and, toSymbol } from './seven-logic';
import { SEED_KERNEL } from './seed-kernel';

// ── インスタンス票 ──

export interface InstanceVote {
  instanceId: string;           // インスタンスID
  value: SevenLogicValue;       // 七価論理値での回答
  reasoning: string;            // 根拠テキスト
  axiomRefs: string[];          // 参照した公理ID
  confidence: number;           // 確信度 0.0〜1.0
  timestamp: number;
}

// ── 合意ラウンド ──

export interface ConsensusRound {
  roundNumber: number;
  votes: InstanceVote[];
  aggregated: SevenLogicValue;  // ラウンド集計値
  converged: boolean;           // 合意に達したか
}

// ── 合意結果 ──

export interface ConsensusResult {
  sessionId: string;
  topic: string;
  rounds: ConsensusRound[];
  finalValue: SevenLogicValue;
  finalConfidence: number;
  totalVotes: number;
  axiomChain: string[];         // 合意に使われた公理チェーン
  explanation: string;
}

// ── ConsensusEngine 本体 ──

export class ConsensusEngine {
  private sessionCounter = 0;

  /**
   * 複数インスタンスの票から合意を形成する（メインAPI）
   */
  reach(
    topic: string,
    votes: InstanceVote[],
    maxRounds = 3,
  ): ConsensusResult {
    const sessionId = `consensus-${++this.sessionCounter}`;
    const rounds: ConsensusRound[] = [];
    let currentVotes = [...votes];

    for (let r = 0; r < maxRounds; r++) {
      const aggregated = this.aggregate(currentVotes);
      const converged = this.isConverged(aggregated);

      rounds.push({
        roundNumber: r + 1,
        votes: currentVotes,
        aggregated,
        converged,
      });

      if (converged) break;

      // 未収束: FLOWING票を再評価（次ラウンドで値を絞り込む）
      currentVotes = this.refineVotes(currentVotes, aggregated);
    }

    const lastRound = rounds[rounds.length - 1];
    const finalValue = this.resolveToFinal(lastRound.aggregated);
    const finalConfidence = this.calcConfidence(lastRound.votes, finalValue);
    const axiomChain = this.buildAxiomChain(rounds);
    const explanation = this.buildExplanation(topic, rounds, finalValue);

    return {
      sessionId, topic, rounds,
      finalValue, finalConfidence,
      totalVotes: votes.length,
      axiomChain, explanation,
    };
  }

  /**
   * 単純多数決（七価論理の最頻値）
   */
  plurality(votes: InstanceVote[]): SevenLogicValue {
    const counts = new Map<SevenLogicValue, number>();
    for (const v of votes) {
      counts.set(v.value, (counts.get(v.value) ?? 0) + 1);
    }
    let maxCount = 0;
    let winner: SevenLogicValue = 'ZERO';
    for (const [val, cnt] of counts) {
      if (cnt > maxCount) { maxCount = cnt; winner = val; }
    }
    return winner;
  }

  /**
   * 加重合意（確信度で重み付け）
   */
  weighted(votes: InstanceVote[]): SevenLogicValue {
    const weights = new Map<SevenLogicValue, number>();
    for (const v of votes) {
      weights.set(v.value, (weights.get(v.value) ?? 0) + v.confidence);
    }
    let maxWeight = -1;
    let winner: SevenLogicValue = 'ZERO';
    for (const [val, w] of weights) {
      if (w > maxWeight) { maxWeight = w; winner = val; }
    }
    return winner;
  }

  /**
   * 合意サマリー
   */
  summarize(result: ConsensusResult): string {
    return [
      `合意セッション: ${result.sessionId}`,
      `トピック: 「${result.topic}」`,
      `ラウンド数: ${result.rounds.length}`,
      `総投票数: ${result.totalVotes}`,
      `最終合意: ${toSymbol(result.finalValue)}`,
      `確信度: ${(result.finalConfidence * 100).toFixed(1)}%`,
      `使用公理: ${result.axiomChain.slice(0, 3).join(', ')}`,
    ].join('\n');
  }

  // ── プライベートメソッド ──

  /** 票を七価論理∧で集計 */
  private aggregate(votes: InstanceVote[]): SevenLogicValue {
    if (votes.length === 0) return 'ZERO';
    let result = votes[0].value;
    for (let i = 1; i < votes.length; i++) {
      result = and(result, votes[i].value);
    }
    return result;
  }

  /** 合意に達したか判定 */
  private isConverged(value: SevenLogicValue): boolean {
    // TRUE/FALSE/NEITHER は確定（合意）
    return value === 'TRUE' || value === 'FALSE' || value === 'NEITHER';
  }

  /** FLOWING票を次ラウンド用に絞り込む */
  private refineVotes(
    votes: InstanceVote[],
    currentAgg: SevenLogicValue,
  ): InstanceVote[] {
    return votes.map(v => {
      if (v.value === 'FLOWING') {
        // FLOWING はより確定的な値に収束（多数派に寄せる）
        return { ...v, value: currentAgg === 'BOTH' ? 'NEITHER' : currentAgg };
      }
      if (v.value === 'BOTH') {
        // BOTH → Ω収束 → TRUE
        return { ...v, value: 'TRUE' as SevenLogicValue, confidence: v.confidence * 0.8 };
      }
      return v;
    });
  }

  /** 最終値に解決（BOTH→TRUE, INFINITY→NEITHER, FLOWING→TRUE）*/
  private resolveToFinal(value: SevenLogicValue): SevenLogicValue {
    if (value === 'BOTH')     return 'TRUE';     // Ω収束
    if (value === 'INFINITY') return 'NEITHER';  // 評価不能→判断保留
    if (value === 'ZERO')     return 'NEITHER';  // 未観測→判断保留
    if (value === 'FLOWING')  return 'TRUE';     // 流動→Ω収束
    return value;
  }

  /** 全ラウンドから確信度を計算 */
  private calcConfidence(votes: InstanceVote[], finalValue: SevenLogicValue): number {
    const agreeing = votes.filter(v =>
      v.value === finalValue || v.value === 'FLOWING'
    ).length;
    const base = votes.length > 0 ? agreeing / votes.length : 0;
    // BOTH が含まれる場合は確信度を下げる
    const hasBoth = votes.some(v => v.value === 'BOTH');
    return hasBoth ? base * 0.7 : base;
  }

  /** 全ラウンドから公理チェーンを構築 */
  private buildAxiomChain(rounds: ConsensusRound[]): string[] {
    const axiomSet = new Set<string>();
    for (const round of rounds) {
      for (const vote of round.votes) {
        vote.axiomRefs.forEach(id => axiomSet.add(id));
      }
    }
    return [...axiomSet].slice(0, 5);
  }

  /** 人間可読な説明を生成 */
  private buildExplanation(
    topic: string,
    rounds: ConsensusRound[],
    final: SevenLogicValue,
  ): string {
    const lines = [
      `トピック「${topic}」の分散協調推論結果:`,
    ];
    for (const r of rounds) {
      lines.push(
        `  ラウンド${r.roundNumber}: ${r.votes.length}票 → 集計値 ${toSymbol(r.aggregated)}`
        + (r.converged ? '（合意達成）' : '（継続）'),
      );
    }
    lines.push(`最終合意: ${toSymbol(final)}`);
    return lines.join('\n');
  }
}
