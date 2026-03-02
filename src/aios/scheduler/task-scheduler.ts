/**
 * Rei AIOS — Task Scheduler
 * Phase 4: 自律タスクスケジューラ
 *
 * 時間・イベント駆動でタスクを自律実行する。
 *
 * D-FUMT 中心-周囲パターン:
 *   中心 = スケジューラコア（不変な時刻評価ループ）
 *   周囲 = 登録されたタスク群（動的追加・削除可能）
 *
 * 設計原則:
 *   - タスクは純粋な async 関数
 *   - 失敗時は自動リトライ（指数バックオフ）
 *   - 実行履歴を JSON で永続化
 *   - Rei言語の「周囲から中心へ情報が集約される」構造に対応
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

// ─── 型定義 ────────────────────────────────────────────

/** タスクの実行スケジュール */
export type ScheduleTrigger =
  | { type: 'interval'; intervalMs: number }      // 一定間隔
  | { type: 'cron'; expression: string }           // cron式（簡易実装）
  | { type: 'once'; runAt: Date }                  // 一度だけ
  | { type: 'event'; eventName: string }           // イベント駆動

/** タスク実行結果 */
export interface TaskRunRecord {
  taskId: string;
  startedAt: string;
  finishedAt: string;
  success: boolean;
  durationMs: number;
  error?: string;
  output?: string;
}

/** タスク設定 */
export interface ScheduledTask {
  /** 一意なID */
  id: string;
  /** 表示名 */
  name: string;
  /** スケジュール */
  trigger: ScheduleTrigger;
  /** タスク本体 */
  fn: () => Promise<string | void>;
  /** 有効/無効 */
  enabled: boolean;
  /** 最大リトライ回数 */
  maxRetries: number;
  /** リトライ間隔（ms）※指数バックオフの初期値 */
  retryBaseMs: number;
  /** タイムアウト（ms）。0 = 無制限 */
  timeoutMs: number;
  /** 前回実行時刻 */
  lastRun?: Date;
  /** 次回実行予定時刻 */
  nextRun?: Date;
}

export type TaskStatus = 'pending' | 'running' | 'idle' | 'disabled' | 'failed';

export interface TaskInfo {
  id: string;
  name: string;
  status: TaskStatus;
  lastRun?: string;
  nextRun?: string;
  runCount: number;
  failCount: number;
}

// ─── TaskScheduler クラス ────────────────────────────

export class TaskScheduler extends EventEmitter {
  private tasks = new Map<string, ScheduledTask>();
  private timers = new Map<string, ReturnType<typeof setInterval | typeof setTimeout>>();
  private running = new Set<string>();
  private runCounts = new Map<string, number>();
  private failCounts = new Map<string, number>();
  private historyPath: string;
  private history: TaskRunRecord[] = [];
  private maxHistoryItems = 200;
  private log: (msg: string) => void;
  private started = false;

  constructor(dataDir: string, log?: (msg: string) => void) {
    super();
    this.historyPath = path.join(dataDir, 'scheduler-history.json');
    this.log = log || ((msg) => console.log(`[TaskScheduler] ${msg}`));
    this.loadHistory();
  }

  // ─── タスク登録 ────────────────────────────────────

  register(task: Omit<ScheduledTask, 'lastRun' | 'nextRun'>): void {
    const fullTask: ScheduledTask = {
      ...task,
      maxRetries: task.maxRetries ?? 3,
      retryBaseMs: task.retryBaseMs ?? 2000,
      timeoutMs: task.timeoutMs ?? 0,
    };
    this.tasks.set(task.id, fullTask);
    this.runCounts.set(task.id, this.runCounts.get(task.id) ?? 0);
    this.failCounts.set(task.id, this.failCounts.get(task.id) ?? 0);
    this.log(`Registered task: ${task.id} (${task.name})`);

    if (this.started) {
      this.scheduleTask(fullTask);
    }
  }

  unregister(taskId: string): void {
    this.clearTimer(taskId);
    this.tasks.delete(taskId);
    this.log(`Unregistered task: ${taskId}`);
  }

  setEnabled(taskId: string, enabled: boolean): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    task.enabled = enabled;
    if (enabled) {
      this.scheduleTask(task);
    } else {
      this.clearTimer(taskId);
    }
    this.emit('task-enabled-changed', { taskId, enabled });
  }

  // ─── スケジューラ起動・停止 ────────────────────────

  start(): void {
    if (this.started) return;
    this.started = true;
    this.log(`Scheduler started. Tasks: ${this.tasks.size}`);

    for (const task of this.tasks.values()) {
      if (task.enabled) {
        this.scheduleTask(task);
      }
    }
  }

  stop(): void {
    this.started = false;
    for (const taskId of this.timers.keys()) {
      this.clearTimer(taskId);
    }
    this.log('Scheduler stopped.');
  }

  // ─── 手動実行 ──────────────────────────────────────

  async runNow(taskId: string): Promise<TaskRunRecord> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    return this.executeTask(task);
  }

  // ─── 状態取得 ──────────────────────────────────────

  getAllTaskInfo(): TaskInfo[] {
    return Array.from(this.tasks.values()).map(task => ({
      id: task.id,
      name: task.name,
      status: this.getTaskStatus(task),
      lastRun: task.lastRun?.toISOString(),
      nextRun: task.nextRun?.toISOString(),
      runCount: this.runCounts.get(task.id) ?? 0,
      failCount: this.failCounts.get(task.id) ?? 0,
    }));
  }

  getHistory(taskId?: string, limit = 20): TaskRunRecord[] {
    const filtered = taskId
      ? this.history.filter(r => r.taskId === taskId)
      : this.history;
    return filtered.slice(-limit);
  }

  private getTaskStatus(task: ScheduledTask): TaskStatus {
    if (!task.enabled) return 'disabled';
    if (this.running.has(task.id)) return 'running';
    const failCount = this.failCounts.get(task.id) ?? 0;
    const runCount = this.runCounts.get(task.id) ?? 0;
    if (failCount > 0 && failCount === runCount) return 'failed';
    return task.lastRun ? 'idle' : 'pending';
  }

  // ─── スケジューリング内部実装 ──────────────────────

  private scheduleTask(task: ScheduledTask): void {
    this.clearTimer(task.id);

    const { trigger } = task;

    if (trigger.type === 'interval') {
      // 起動直後に1回実行してからインターバル
      const timer = setInterval(() => {
        this.executeTask(task).catch(err => {
          this.log(`Task ${task.id} unhandled error: ${err.message}`);
        });
      }, trigger.intervalMs);

      this.timers.set(task.id, timer);

      // 次回実行予定を設定
      task.nextRun = new Date(Date.now() + trigger.intervalMs);

    } else if (trigger.type === 'once') {
      const delay = Math.max(0, trigger.runAt.getTime() - Date.now());
      const timer = setTimeout(() => {
        this.executeTask(task).catch(err => {
          this.log(`Task ${task.id} unhandled error: ${err.message}`);
        });
      }, delay);
      this.timers.set(task.id, timer);
      task.nextRun = trigger.runAt;

    } else if (trigger.type === 'cron') {
      // 簡易cron: 1分ごとに評価
      const timer = setInterval(() => {
        if (this.matchesCron(trigger.expression)) {
          this.executeTask(task).catch(err => {
            this.log(`Task ${task.id} unhandled error: ${err.message}`);
          });
        }
      }, 60 * 1000);
      this.timers.set(task.id, timer);
    }
    // event型はイベント名でトリガー（emit経由）
  }

  /**
   * イベント型タスクをトリガーする
   */
  triggerEvent(eventName: string): void {
    for (const task of this.tasks.values()) {
      if (
        task.enabled &&
        task.trigger.type === 'event' &&
        task.trigger.eventName === eventName
      ) {
        this.executeTask(task).catch(err => {
          this.log(`Event task ${task.id} error: ${err.message}`);
        });
      }
    }
  }

  // ─── タスク実行 ────────────────────────────────────

  private async executeTask(
    task: ScheduledTask,
    retryCount = 0
  ): Promise<TaskRunRecord> {
    if (this.running.has(task.id)) {
      this.log(`Task ${task.id} is already running. Skip.`);
      return {
        taskId: task.id,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        success: false,
        durationMs: 0,
        error: 'Already running',
      };
    }

    this.running.add(task.id);
    const startedAt = new Date();
    this.emit('task-start', { taskId: task.id, name: task.name, retryCount });
    this.log(`▶ Task start: ${task.id} (retry: ${retryCount})`);

    let success = false;
    let error: string | undefined;
    let output: string | undefined;

    try {
      // タイムアウト制御
      const fnPromise = task.fn();
      const resultOrVoid = task.timeoutMs > 0
        ? await Promise.race([
            fnPromise,
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`Timeout after ${task.timeoutMs}ms`)), task.timeoutMs)
            ),
          ])
        : await fnPromise;

      output = typeof resultOrVoid === 'string' ? resultOrVoid : undefined;
      success = true;
      task.lastRun = startedAt;
      this.runCounts.set(task.id, (this.runCounts.get(task.id) ?? 0) + 1);
      this.log(`✅ Task done: ${task.id} (${Date.now() - startedAt.getTime()}ms)`);

    } catch (err: any) {
      error = err.message;
      this.failCounts.set(task.id, (this.failCounts.get(task.id) ?? 0) + 1);
      this.log(`❌ Task failed: ${task.id} — ${error}`);

      // リトライ
      if (retryCount < task.maxRetries) {
        const delay = task.retryBaseMs * Math.pow(2, retryCount); // 指数バックオフ
        this.log(`  Retry in ${delay}ms (${retryCount + 1}/${task.maxRetries})`);
        this.running.delete(task.id);
        await new Promise(r => setTimeout(r, delay));
        return this.executeTask(task, retryCount + 1);
      }
    } finally {
      this.running.delete(task.id);
    }

    const record: TaskRunRecord = {
      taskId: task.id,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      success,
      durationMs: Date.now() - startedAt.getTime(),
      error,
      output,
    };

    this.addHistory(record);
    this.emit('task-complete', record);

    // 次回実行予定を更新（interval型）
    if (task.trigger.type === 'interval') {
      task.nextRun = new Date(Date.now() + task.trigger.intervalMs);
    }

    return record;
  }

  // ─── 簡易cron マッチング ───────────────────────────

  /**
   * 現在時刻が cron 式にマッチするか（分・時・日・月・曜日の5フィールド）
   * 例: "0 6 * * *" = 毎日6時00分
   */
  private matchesCron(expression: string): boolean {
    const parts = expression.trim().split(/\s+/);
    if (parts.length !== 5) return false;

    const now = new Date();
    const fields = [
      now.getMinutes(),
      now.getHours(),
      now.getDate(),
      now.getMonth() + 1,
      now.getDay(), // 0=日曜
    ];

    return parts.every((part, i) => {
      if (part === '*') return true;
      const val = parseInt(part, 10);
      return val === fields[i];
    });
  }

  // ─── タイマー管理 ──────────────────────────────────

  private clearTimer(taskId: string): void {
    const timer = this.timers.get(taskId);
    if (timer !== undefined) {
      clearInterval(timer as any);
      clearTimeout(timer as any);
      this.timers.delete(taskId);
    }
  }

  // ─── 履歴永続化 ────────────────────────────────────

  private loadHistory(): void {
    try {
      if (fs.existsSync(this.historyPath)) {
        this.history = JSON.parse(fs.readFileSync(this.historyPath, 'utf-8'));
      }
    } catch { this.history = []; }
  }

  private addHistory(record: TaskRunRecord): void {
    this.history.push(record);
    if (this.history.length > this.maxHistoryItems) {
      this.history = this.history.slice(-this.maxHistoryItems);
    }
    try {
      fs.writeFileSync(this.historyPath, JSON.stringify(this.history, null, 2));
    } catch (err: any) {
      this.log(`History save error: ${err.message}`);
    }
  }
}
