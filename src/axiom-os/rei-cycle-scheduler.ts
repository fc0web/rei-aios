/**
 * ReiCycleScheduler — 周期の最小公倍数スケジューリング
 *
 * D-FUMT Theory #72: アステカ周期合流理論
 * 「異なる周期を持つプロセスは LCM(p1,p2,...) の時点で合流する」
 *
 * アステカ対応:
 *   365日暦 -> タスクA（例: 毎日実行）
 *   260日暦 -> タスクB（例: 6時間ごと）
 *   52年    -> 合流点（INFINITY: 全タスクが同期する瞬間）
 *
 * 七価論理との統合:
 *   次の合流まで遠い -> ZERO（潜在待機）
 *   合流が近づく    -> FLOWING（収束中）
 *   合流点          -> INFINITY（全周期の交点）
 *   合流後          -> TRUE（実行完了）
 */

import { type SevenLogicValue } from './seven-logic';

export interface CycleTask {
  id: string;
  periodMs: number;        // 周期（ミリ秒）
  lastRunAt: number;       // 最終実行時刻
  description: string;
}

export interface CycleAlignment {
  lcmMs: number;            // 全タスクの最小公倍数周期
  nextAlignmentAt: number;  // 次の合流時刻
  msUntilAlignment: number; // 合流まで残り時間
  logicTag: SevenLogicValue; // 合流の七価論理状態
  alignmentRatio: number;   // 合流への進捗（0〜1）
}

export interface TaskSyncStatus {
  task: CycleTask;
  nextRunAt: number;
  msUntilRun: number;
  phase: number;           // 現在の位相（0〜1）
  logicTag: SevenLogicValue;
}

export class ReiCycleScheduler {
  private tasks: Map<string, CycleTask> = new Map();

  /** タスクを登録 */
  register(task: CycleTask): void {
    this.tasks.set(task.id, { ...task });
  }

  /** 最大公約数（GCD） */
  private gcd(a: number, b: number): number {
    a = Math.round(a); b = Math.round(b);
    while (b > 0) { [a, b] = [b, a % b]; }
    return a;
  }

  /** 最小公倍数（LCM） */
  private lcm(a: number, b: number): number {
    return (a / this.gcd(a, b)) * b;
  }

  /**
   * 全タスクの最小公倍数周期（合流点）を計算する
   * アステカの52年 = lcm(365, 260) の計算
   */
  calcAlignment(): CycleAlignment {
    const periods = [...this.tasks.values()].map(t => t.periodMs);
    if (periods.length === 0) {
      return {
        lcmMs: 0, nextAlignmentAt: 0, msUntilAlignment: 0,
        logicTag: 'ZERO', alignmentRatio: 0,
      };
    }

    // 全周期のLCM（オーバーフロー対策で上限を設ける）
    let lcmMs = periods[0];
    for (let i = 1; i < periods.length; i++) {
      lcmMs = this.lcm(lcmMs, periods[i]);
      if (lcmMs > 365 * 24 * 60 * 60 * 1000) {
        // 1年超のLCMは「実質無限」としてINFINITY扱い
        lcmMs = 365 * 24 * 60 * 60 * 1000;
        break;
      }
    }

    const now = Date.now();
    // 全タスクの基準点（最も古いlastRunAt）
    const baseTime = Math.min(...[...this.tasks.values()].map(t => t.lastRunAt || now));
    const elapsed = now - baseTime;
    const cyclePos = elapsed % lcmMs;
    const msUntilAlignment = lcmMs - cyclePos;
    const nextAlignmentAt = now + msUntilAlignment;
    const alignmentRatio = cyclePos / lcmMs;

    // 合流の七価論理状態
    const logicTag: SevenLogicValue =
      msUntilAlignment < 1000          ? 'INFINITY' :  // 合流直前/合流中
      msUntilAlignment < lcmMs * 0.05  ? 'FLOWING'  :  // 5%以内に迫っている
      msUntilAlignment < lcmMs * 0.2   ? 'NEITHER'  :  // 近づいている
      alignmentRatio < 0.1             ? 'TRUE'      :  // 合流直後
                                         'ZERO';        // 遠い

    return {
      lcmMs,
      nextAlignmentAt,
      msUntilAlignment,
      logicTag,
      alignmentRatio,
    };
  }

  /**
   * 個々のタスクの同期状態を返す
   */
  getTaskStatuses(): TaskSyncStatus[] {
    const now = Date.now();
    return [...this.tasks.values()].map(task => {
      const elapsed = now - (task.lastRunAt || now);
      const phase = (elapsed % task.periodMs) / task.periodMs;
      const msUntilRun = task.periodMs - (elapsed % task.periodMs);
      const nextRunAt = now + msUntilRun;

      const logicTag: SevenLogicValue =
        msUntilRun < 1000              ? 'INFINITY' :
        phase > 0.9                    ? 'FLOWING'  :
        phase < 0.1                    ? 'TRUE'     :
                                         'ZERO';

      return { task, nextRunAt, msUntilRun, phase, logicTag };
    });
  }

  /**
   * scheduled-tasks.ts の既存スケジューラと統合するヘルパー
   * 全タスクの周期からLCMを計算してログ出力
   */
  formatAlignmentReport(): string {
    const alignment = this.calcAlignment();
    const hours = (alignment.msUntilAlignment / 3600000).toFixed(1);
    const lcmHours = (alignment.lcmMs / 3600000).toFixed(1);
    return [
      `── Rei周期合流レポート（アステカ暦理論）──`,
      `全周期LCM   : ${lcmHours}時間`,
      `次の合流まで: ${hours}時間`,
      `合流進捗    : ${(alignment.alignmentRatio * 100).toFixed(1)}%`,
      `合流状態    : ${alignment.logicTag}`,
    ].join('\n');
  }
}
