/**
 * MoiraTerminator — モイラ三女神による終了条件の形式論理
 *
 * D-FUMT Theory #73: モイラ終了理論
 * 「クロト（生成）× ラケシス（評価）× アトロポス（終了）
 *  の三相が揃って初めて推論は完結する」
 *
 * 現在のReiに欠けていた「廃棄・終了の論理」を補完する。
 *
 * 使用例:
 *   理論が一定期間使用されなければ廃棄候補にする
 *   推論が収束しなければ強制終了する
 *   矛盾が解決不能なら NEITHER として封印する
 */

import { type SevenLogicValue } from './seven-logic';
import { type SeedTheory } from './seed-kernel';

// ── 三相の定義 ──
export type MoiraPhase = 'CLOTHO' | 'LACHESIS' | 'ATROPOS';

// ── 終了条件の種別 ──
export type TerminationReason =
  | 'timeout'           // ラケシス: 時間切れ
  | 'convergence'       // ラケシス: 収束完了（正常終了）
  | 'contradiction'     // アトロポス: 解決不能な矛盾
  | 'unused'            // アトロポス: 長期未使用
  | 'superseded'        // アトロポス: より良い理論に置換
  | 'loop_detected'     // アトロポス: 無限ループ検出（NarcissusDetector連携）
  | 'resource_limit';   // アトロポス: リソース上限

// ── 推論プロセスのライフサイクル ──
export interface ReasoningProcess {
  id: string;
  question: string;
  phase: MoiraPhase;
  startedAt: number;
  evaluatedAt?: number;
  terminatedAt?: number;
  terminationReason?: TerminationReason;
  finalValue: SevenLogicValue;
  iterationCount: number;
  maxIterations: number;       // アトロポスの「糸の長さ」
  timeoutMs: number;           // ラケシスの「測定限界」
}

// ── 理論の廃棄記録 ──
export interface TheoryDisposal {
  theoryId: string;
  reason: TerminationReason;
  disposedAt: number;
  finalValue: SevenLogicValue;
  note: string;
}

// ── 終了判定結果 ──
export interface TerminationJudgment {
  shouldTerminate: boolean;
  reason?: TerminationReason;
  phase: MoiraPhase;
  message: string;
  finalValue: SevenLogicValue;
}

export class MoiraTerminator {
  private processes: Map<string, ReasoningProcess> = new Map();
  private disposals: TheoryDisposal[] = [];
  private counter = 0;

  // ══════════════════════════════════════════════════════════════
  // クロト（生成）: 推論プロセスを開始する
  // ══════════════════════════════════════════════════════════════

  /**
   * 推論プロセスを生成する（クロトが糸を紡ぐ）
   */
  clotho(question: string, options: {
    maxIterations?: number;
    timeoutMs?: number;
  } = {}): ReasoningProcess {
    const id = `moira-${++this.counter}-${Date.now()}`;
    const process: ReasoningProcess = {
      id,
      question,
      phase: 'CLOTHO',
      startedAt: Date.now(),
      finalValue: 'FLOWING',    // 開始時は FLOWING（進行中）
      iterationCount: 0,
      maxIterations: options.maxIterations ?? 100,
      timeoutMs: options.timeoutMs ?? 30_000,
    };
    this.processes.set(id, process);
    return process;
  }

  // ══════════════════════════════════════════════════════════════
  // ラケシス（評価）: 推論の進捗を測定する
  // ══════════════════════════════════════════════════════════════

  /**
   * 推論プロセスを評価し、継続すべきか判定する（ラケシスが糸を測る）
   */
  lachesis(processId: string, currentValue: SevenLogicValue): TerminationJudgment {
    const proc = this.processes.get(processId);
    if (!proc) {
      return {
        shouldTerminate: true,
        reason: 'timeout',
        phase: 'ATROPOS',
        message: 'プロセスが存在しません',
        finalValue: 'NEITHER',
      };
    }

    proc.phase = 'LACHESIS';
    proc.evaluatedAt = Date.now();
    proc.iterationCount++;
    proc.finalValue = currentValue;

    // 収束判定（TRUEまたはFALSEに確定した）
    if (currentValue === 'TRUE' || currentValue === 'FALSE') {
      return {
        shouldTerminate: true,
        reason: 'convergence',
        phase: 'LACHESIS',
        message: `収束完了: ${currentValue}`,
        finalValue: currentValue,
      };
    }

    // タイムアウト判定
    const elapsed = Date.now() - proc.startedAt;
    if (elapsed > proc.timeoutMs) {
      return {
        shouldTerminate: true,
        reason: 'timeout',
        phase: 'LACHESIS',
        message: `タイムアウト: ${(elapsed / 1000).toFixed(1)}秒経過`,
        finalValue: 'NEITHER',
      };
    }

    // 反復上限判定
    if (proc.iterationCount >= proc.maxIterations) {
      return {
        shouldTerminate: true,
        reason: 'resource_limit',
        phase: 'LACHESIS',
        message: `反復上限到達: ${proc.iterationCount}回`,
        finalValue: 'NEITHER',
      };
    }

    // INFINITY は無限分岐の可能性 → 継続するが警告
    if (currentValue === 'INFINITY') {
      return {
        shouldTerminate: false,
        phase: 'LACHESIS',
        message: 'INFINITY検出: 無限分岐の可能性あり、監視継続',
        finalValue: 'INFINITY',
      };
    }

    return {
      shouldTerminate: false,
      phase: 'LACHESIS',
      message: `進行中: ${proc.iterationCount}/${proc.maxIterations}回`,
      finalValue: currentValue,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // アトロポス（終了）: 推論を切断・廃棄する
  // ══════════════════════════════════════════════════════════════

  /**
   * 推論プロセスを強制終了する（アトロポスが糸を切る）
   */
  atropos(processId: string, reason: TerminationReason, note = ''): ReasoningProcess | null {
    const proc = this.processes.get(processId);
    if (!proc) return null;

    proc.phase = 'ATROPOS';
    proc.terminatedAt = Date.now();
    proc.terminationReason = reason;

    // 理由に応じた最終値
    const finalValueMap: Record<TerminationReason, SevenLogicValue> = {
      convergence:    proc.finalValue,  // 収束した値をそのまま
      timeout:        'NEITHER',        // 時間切れ = 不確定
      contradiction:  'BOTH',           // 矛盾 = BOTH封印
      unused:         'ZERO',           // 未使用 = ZEROに戻る
      superseded:     'FLOWING',        // 置換 = 流動へ
      loop_detected:  'NEITHER',        // ループ = 不確定
      resource_limit: 'NEITHER',        // 上限 = 不確定
    };
    proc.finalValue = finalValueMap[reason];

    this.processes.delete(processId);
    return proc;
  }

  /**
   * 理論を廃棄候補として記録する
   * （SEED_KERNELから削除する前の「予告」）
   */
  disposeTheory(theory: SeedTheory, reason: TerminationReason, note: string): TheoryDisposal {
    const disposal: TheoryDisposal = {
      theoryId: theory.id,
      reason,
      disposedAt: Date.now(),
      finalValue: reason === 'contradiction' ? 'BOTH' : 'ZERO',
      note,
    };
    this.disposals.push(disposal);
    return disposal;
  }

  /**
   * 長期未使用の推論プロセスを一括終了する
   * scheduled-tasks.ts から定期実行する
   */
  pruneStale(ttlMs = 60 * 60 * 1000): ReasoningProcess[] {
    const now = Date.now();
    const pruned: ReasoningProcess[] = [];
    for (const [id, proc] of this.processes) {
      if (now - proc.startedAt > ttlMs) {
        const terminated = this.atropos(id, 'unused', '長期未使用による自動終了');
        if (terminated) pruned.push(terminated);
      }
    }
    return pruned;
  }

  getDisposals(): TheoryDisposal[] { return [...this.disposals]; }
  getActiveProcesses(): ReasoningProcess[] { return [...this.processes.values()]; }
}
