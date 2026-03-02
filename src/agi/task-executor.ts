// ============================================================
// Rei-AIOS AGI Layer — Phase 1: Task Executor
// src/agi/task-executor.ts
//
// サブタスクを依存関係順に実行するエンジン。
// 各タスクタイプごとのハンドラは既存のRei-AIOS機能を呼び出す。
// ============================================================

import {
  SubTask, TaskPlan, TaskResult, TaskType, TaskLogEntry,
  AGIConfig, DEFAULT_AGI_CONFIG
} from './task-types';
import { SelfRepairEngine } from './self-repair';

/** タスクハンドラの型定義 */
export type TaskHandler = (
  task: SubTask,
  dependencyResults: Map<string, TaskResult>
) => Promise<TaskResult>;

/** タスク実行イベントのコールバック */
export interface TaskExecutorEvents {
  onTaskStart?: (task: SubTask) => void;
  onTaskDone?: (task: SubTask, result: TaskResult) => void;
  onTaskFail?: (task: SubTask, error: string) => void;
  onTaskRepair?: (task: SubTask, strategy: string) => void;  // ★ Phase 2
  onPlanDone?: (plan: TaskPlan, results: Map<string, TaskResult>) => void;
  onLog?: (entry: TaskLogEntry) => void;
}

/**
 * TaskExecutor — サブタスクを依存関係順に実行
 */
export class TaskExecutor {
  private handlers: Map<TaskType, TaskHandler> = new Map();
  private config: AGIConfig;
  private events: TaskExecutorEvents;
  private logs: TaskLogEntry[] = [];
  private selfRepair: SelfRepairEngine | null = null;  // ★ Phase 2

  constructor(config?: Partial<AGIConfig>, events?: TaskExecutorEvents) {
    this.config = { ...DEFAULT_AGI_CONFIG, ...config };
    this.events = events || {};
  }

  // ★ Phase 2: SelfRepairEngineを接続
  setSelfRepair(engine: SelfRepairEngine): void {
    this.selfRepair = engine;
  }

  /**
   * タスクハンドラを登録
   * 既存のRei-AIOS機能をハンドラとして接続する。
   */
  registerHandler(type: TaskType, handler: TaskHandler): void {
    this.handlers.set(type, handler);
  }

  /**
   * タスク計画を実行
   */
  async execute(plan: TaskPlan): Promise<Map<string, TaskResult>> {
    const results = new Map<string, TaskResult>();
    plan.status = 'executing';

    // 依存関係に基づく実行順序を計算
    const executionOrder = this.topologicalSort(plan.subtasks);

    for (const taskId of executionOrder) {
      const task = plan.subtasks.find(t => t.id === taskId);
      if (!task) continue;

      // 依存タスクが全て成功しているか確認
      const depsOk = task.dependencies.every(depId => {
        const depResult = results.get(depId);
        return depResult && depResult.success;
      });

      if (!depsOk) {
        // 依存タスクが失敗 → このタスクはスキップ
        task.status = 'skipped';
        this.log(plan.id, task.id, 'skip', `依存タスク未完了のためスキップ`);
        results.set(task.id, {
          taskId: task.id,
          success: false,
          error: '依存タスクが失敗したためスキップ',
          duration: 0
        });
        continue;
      }

      // タスク実行（リトライ付き ★ Phase 2: SelfRepair対応）
      const result = await this.executeWithRetry(task, results, plan.id, plan);
      results.set(task.id, result);
    }

    // 全体の完了判定
    const allDone = plan.subtasks.every(t =>
      t.status === 'done' || t.status === 'skipped'
    );
    const anyFailed = plan.subtasks.some(t => t.status === 'failed');

    plan.status = anyFailed ? 'failed' : 'done';
    plan.completedAt = Date.now();

    this.events.onPlanDone?.(plan, results);

    return results;
  }

  /**
   * リトライ付きタスク実行（★ Phase 2: SelfRepair統合）
   */
  private async executeWithRetry(
    task: SubTask,
    results: Map<string, TaskResult>,
    planId: string,
    plan?: TaskPlan
  ): Promise<TaskResult> {

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      if (attempt > 0) {
        task.retryCount = attempt;
        this.log(planId, task.id, 'retry', `リトライ ${attempt}/${this.config.maxRetries}`);
      }

      const result = await this.executeSingle(task, results, planId);

      if (result.success) {
        return result;
      }

      // ★ Phase 2: SelfRepairが利用可能なら、単純リトライではなく自己修復を試行
      if (this.selfRepair && plan && attempt < this.config.maxRetries) {
        const repairResult = await this.selfRepair.repair(
          task, result.error || '不明なエラー', plan, results
        );

        this.log(planId, task.id, 'retry',
          `[自己修復] 戦略: ${repairResult.appliedStrategy} (${repairResult.repairDuration}ms)`
        );
        this.events.onTaskRepair?.(task, repairResult.appliedStrategy);

        if (repairResult.success && repairResult.appliedStrategy !== 'escalate') {
          // 修復されたタスクで次のループへ（taskは既にapplyStrategyで更新済み）
          continue;
        } else {
          // 修復不能
          task.status = 'failed';
          task.error = result.error;
          this.log(planId, task.id, 'fail', `自己修復失敗: ${result.error}`);
          this.events.onTaskFail?.(task, result.error || '不明なエラー');
          return result;
        }
      }

      // SelfRepair未接続時の従来動作: 最後のリトライも失敗
      if (attempt === this.config.maxRetries) {
        task.status = 'failed';
        task.error = result.error;
        this.log(planId, task.id, 'fail', result.error || '不明なエラー');
        this.events.onTaskFail?.(task, result.error || '不明なエラー');
        return result;
      }
    }

    // ここには到達しないが型安全のため
    return { taskId: task.id, success: false, error: 'unexpected', duration: 0 };
  }

  /**
   * 単一タスクの実行
   */
  private async executeSingle(
    task: SubTask,
    results: Map<string, TaskResult>,
    planId: string
  ): Promise<TaskResult> {

    const handler = this.handlers.get(task.type);
    if (!handler) {
      return {
        taskId: task.id,
        success: false,
        error: `ハンドラ未登録: ${task.type}`,
        duration: 0
      };
    }

    task.status = 'running';
    task.startedAt = Date.now();
    this.log(planId, task.id, 'start', task.description);
    this.events.onTaskStart?.(task);

    try {
      // タイムアウト付き実行
      const result = await this.withTimeout(
        handler(task, results),
        this.config.timeoutMs
      );

      task.status = result.success ? 'done' : 'failed';
      task.completedAt = Date.now();
      task.result = result.data;

      if (result.success) {
        this.log(planId, task.id, 'done', `完了 (${result.duration}ms)`);
        this.events.onTaskDone?.(task, result);
      }

      return result;

    } catch (error: any) {
      task.status = 'failed';
      task.completedAt = Date.now();
      const errMsg = error?.message || String(error);

      return {
        taskId: task.id,
        success: false,
        error: errMsg,
        duration: Date.now() - (task.startedAt || Date.now())
      };
    }
  }

  /**
   * タイムアウト付きPromise実行
   */
  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`タイムアウト (${ms}ms)`)), ms);
      promise
        .then(val => { clearTimeout(timer); resolve(val); })
        .catch(err => { clearTimeout(timer); reject(err); });
    });
  }

  /**
   * トポロジカルソート（依存関係順にタスクを並べる）
   */
  private topologicalSort(tasks: SubTask[]): string[] {
    const visited = new Set<string>();
    const order: string[] = [];
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    const visit = (taskId: string) => {
      if (visited.has(taskId)) return;
      visited.add(taskId);

      const task = taskMap.get(taskId);
      if (!task) return;

      // 先に依存タスクを処理
      for (const depId of task.dependencies) {
        visit(depId);
      }
      order.push(taskId);
    };

    tasks.forEach(t => visit(t.id));
    return order;
  }

  /**
   * ログ記録
   */
  private log(planId: string, taskId: string, event: TaskLogEntry['event'], message: string): void {
    const entry: TaskLogEntry = {
      timestamp: Date.now(),
      planId,
      taskId,
      event,
      message
    };
    this.logs.push(entry);
    this.events.onLog?.(entry);
  }

  /**
   * ログ取得
   */
  getLogs(): TaskLogEntry[] {
    return [...this.logs];
  }

  /**
   * ログクリア
   */
  clearLogs(): void {
    this.logs = [];
  }
}
