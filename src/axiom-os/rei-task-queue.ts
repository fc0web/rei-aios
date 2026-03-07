/**
 * ReiTaskQueue — 七価論理タスクキュー
 *
 * 情報処理タスクの状態遷移を七価論理で表現する。
 *
 * タスク状態 x 七価論理対応:
 *   Running  -> TRUE      (確定・実行中)
 *   Waiting  -> FLOWING   (待機・変化中)
 *   Ready    -> NEITHER   (準備完了・未割当)
 *   Blocked  -> ZERO      (潜在・未開始)
 *   Error    -> BOTH      (矛盾状態)
 *   Infinite -> INFINITY  (発散・ループ)
 *   Done     -> FALSE     (完了・終了)
 *
 * スケジューリング戦略:
 *   FIFO     -> 到達順
 *   PRIORITY -> 優先度順（七価論理スコアで自動算出）
 *   ROUND_ROBIN -> 均等タイムスライス
 *
 * @author Nobuki Fujimoto (D-FUMT) + Claude
 */

import { type SevenLogicValue } from './seven-logic';
import { MoiraTerminator } from './moira-terminator';
import { getReiAIOSRuntime } from '../aios/rei-aios-runtime-bus';

// ── 型定義 ──────────────────────────────────────────────

export type TaskState = 'READY' | 'RUNNING' | 'WAITING' | 'BLOCKED' | 'DONE' | 'ERROR' | 'INFINITE';
export type ScheduleStrategy = 'FIFO' | 'PRIORITY' | 'ROUND_ROBIN';

export interface ReiTask {
  id: string;
  name: string;
  category: string;           // 'logic' | 'proof' | 'discovery' | 'sensor' | 'custom'
  priority: number;           // 0〜10（高いほど優先）
  state: TaskState;
  logicValue: SevenLogicValue;
  payload: unknown;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  moiraProcessId?: string;    // MoiraTerminator連携
  timeoutMs: number;          // デフォルト 30000ms
  retries: number;
  maxRetries: number;
  fn: () => Promise<unknown>; // 実行関数
  result?: unknown;
  error?: string;
}

export interface TaskQueueStats {
  total: number;
  byState: Record<TaskState, number>;
  byLogicValue: Record<string, number>;
  avgWaitMs: number;
  avgRunMs: number;
}

// ── ReiTaskQueue ─────────────────────────────────────────

export class ReiTaskQueue {
  private queue: ReiTask[] = [];
  private running: Map<string, ReiTask> = new Map();
  private history: ReiTask[] = [];
  private moira: MoiraTerminator;
  private strategy: ScheduleStrategy;
  private maxConcurrent: number;
  private idCounter = 0;

  constructor(options: {
    strategy?: ScheduleStrategy;
    maxConcurrent?: number;
  } = {}) {
    this.strategy = options.strategy ?? 'PRIORITY';
    this.maxConcurrent = options.maxConcurrent ?? 3;
    this.moira = new MoiraTerminator();
  }

  // ── タスク登録 ────────────────────────────────────────

  enqueue(task: Omit<ReiTask, 'id' | 'state' | 'logicValue' | 'createdAt' | 'retries'>): ReiTask {
    const id = `task-${++this.idCounter}-${Date.now()}`;
    const newTask: ReiTask = {
      ...task,
      id,
      state: 'READY',
      logicValue: 'NEITHER',  // Ready = NEITHER
      createdAt: Date.now(),
      retries: 0,
    };
    this.queue.push(newTask);
    this._sort();
    return newTask;
  }

  // ── 次のタスクを取得（スケジューリング戦略適用）──────

  private _sort(): void {
    if (this.strategy === 'FIFO') {
      this.queue.sort((a, b) => a.createdAt - b.createdAt);
    } else if (this.strategy === 'PRIORITY') {
      this.queue.sort((a, b) => b.priority - a.priority);
    }
    // ROUND_ROBIN はそのまま（循環インデックスで管理）
  }

  // ── タスク実行ループ ──────────────────────────────────

  async tick(): Promise<void> {
    // 実行中タスクのタイムアウトチェック
    for (const [id, task] of this.running) {
      if (task.startedAt && Date.now() - task.startedAt > task.timeoutMs) {
        task.state = 'ERROR';
        task.logicValue = 'BOTH';  // タイムアウト = 矛盾状態
        task.error = 'timeout';
        if (task.moiraProcessId) {
          this.moira.atropos(task.moiraProcessId, 'timeout');
        }
        this.running.delete(id);
        this.history.push(task);
      }
    }

    // 空きスロットにキューからタスクを投入
    while (this.running.size < this.maxConcurrent && this.queue.length > 0) {
      const task = this.queue.shift()!;
      await this._execute(task);
    }
  }

  private async _execute(task: ReiTask): Promise<void> {
    // Moira: clotho（開始）
    const process = this.moira.clotho(task.name, {
      maxIterations: task.maxRetries + 1,
    });
    task.moiraProcessId = process.id;
    task.state = 'RUNNING';
    task.logicValue = 'FLOWING';  // 実行中 = FLOWING（Waiting中）
    task.startedAt = Date.now();
    this.running.set(task.id, task);

    // RuntimeBus に inference イベント発火
    try {
      const bus = getReiAIOSRuntime();
      bus.publish({
        type: 'inference',
        payload: {
          question: task.name,
          depth: 1,
          axiomIds: [task.category],
          logicValues: ['FLOWING' as SevenLogicValue],
          result: 'FLOWING' as SevenLogicValue,
        },
        source: 'ReiTaskQueue',
        timestamp: Date.now(),
      });
    } catch { /* RuntimeBus未接続時は無視 */ }

    try {
      // 実行
      task.logicValue = 'TRUE';  // Running = TRUE
      const result = await task.fn();
      task.result = result;
      task.state = 'DONE';
      task.logicValue = 'FALSE'; // Done = FALSE（完了・終了）
      task.finishedAt = Date.now();

      // Moira: atropos（収束完了）
      this.moira.atropos(task.moiraProcessId!, 'convergence');

    } catch (err: unknown) {
      task.retries++;
      if (task.retries < task.maxRetries) {
        // リトライ: WAITINGに戻す
        task.state = 'WAITING';
        task.logicValue = 'FLOWING';
        this.queue.unshift(task);
        this.moira.atropos(task.moiraProcessId!, 'timeout');
      } else {
        task.state = 'ERROR';
        task.logicValue = 'BOTH';  // Error = BOTH（矛盾）
        task.error = String(err);
        task.finishedAt = Date.now();
        this.moira.atropos(task.moiraProcessId!, 'contradiction');
      }
    } finally {
      this.running.delete(task.id);
      if (task.state === 'DONE' || task.state === 'ERROR') {
        this.history.push(task);
      }
    }
  }

  // ── 状態取得 ─────────────────────────────────────────

  getStats(): TaskQueueStats {
    const all = [...this.queue, ...this.running.values(), ...this.history];
    const byState = {} as Record<TaskState, number>;
    const byLogicValue: Record<string, number> = {};

    for (const t of all) {
      byState[t.state] = (byState[t.state] || 0) + 1;
      byLogicValue[t.logicValue] = (byLogicValue[t.logicValue] || 0) + 1;
    }

    const done = this.history.filter(t => t.state === 'DONE');
    const avgWaitMs = done.length > 0
      ? done.reduce((s, t) => s + ((t.startedAt ?? t.createdAt) - t.createdAt), 0) / done.length
      : 0;
    const avgRunMs = done.length > 0
      ? done.reduce((s, t) => s + ((t.finishedAt ?? 0) - (t.startedAt ?? 0)), 0) / done.length
      : 0;

    return { total: all.length, byState, byLogicValue, avgWaitMs, avgRunMs };
  }

  getPending(): ReiTask[] { return [...this.queue]; }
  getRunning(): ReiTask[] { return [...this.running.values()]; }
  getHistory(limit = 20): ReiTask[] { return this.history.slice(-limit); }

  // ── 自動実行ループ（Lv2）────────────────────────────

  private _autoTimer: ReturnType<typeof setInterval> | null = null;

  startAutoTick(intervalMs = 1000): void {
    if (this._autoTimer) return; // 多重起動防止
    this._autoTimer = setInterval(() => {
      this.tick().catch(err => console.error('[ReiTaskQueue] tick error:', err));
    }, intervalMs);
    console.log(`[ReiTaskQueue] 自動実行開始 (interval: ${intervalMs}ms)`);
  }

  stopAutoTick(): void {
    if (this._autoTimer) {
      clearInterval(this._autoTimer);
      this._autoTimer = null;
      console.log('[ReiTaskQueue] 自動実行停止');
    }
  }

  // ── グローバルシングルトン ─────────────────────────

  static _instance: ReiTaskQueue | null = null;
  static getInstance(): ReiTaskQueue {
    if (!ReiTaskQueue._instance) {
      ReiTaskQueue._instance = new ReiTaskQueue({
        strategy: 'PRIORITY',
        maxConcurrent: 3,
      });
    }
    return ReiTaskQueue._instance;
  }
}
