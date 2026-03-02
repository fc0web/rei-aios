/**
 * Rei-AIOS Multi-Agent — エージェント基底クラス (agent.ts)
 * テーマE: マルチエージェント並列化
 *
 * 全エージェントの共通インターフェースと基底実装。
 * Rei-AIOS内を自由に「出入り」するAIエージェントの設計図。
 */

import { EventEmitter } from 'events';

// ============================================================
// 型定義
// ============================================================

/** エージェントの状態 */
export type AgentStatus =
  | 'idle'       // 待機中
  | 'running'    // 実行中
  | 'waiting'    // 他エージェント待ち
  | 'suspended'  // 一時停止
  | 'done'       // 完了
  | 'error';     // エラー

/** エージェントの役割 */
export type AgentRole =
  | 'orchestrator'  // 指揮者: タスクを分配
  | 'executor'      // 実行者: タスクを実行
  | 'analyzer'      // 分析者: D-FUMTで分析
  | 'reviewer'      // 審査者: 結果を検証
  | 'memory';       // 記憶者: 履歴を保持

/** エージェント間メッセージ */
export interface AgentMessage {
  id:         string;
  from:       string;       // 送信エージェントID
  to:         string;       // 受信エージェントID ('*' = 全体ブロードキャスト)
  type:       'task' | 'result' | 'query' | 'broadcast' | 'control';
  payload:    unknown;
  timestamp:  number;
  replyTo?:   string;       // 返信対象メッセージID
  priority:   1 | 2 | 3;   // 1=高, 2=中, 3=低
}

/** タスク定義 */
export interface AgentTask {
  id:          string;
  type:        string;
  description: string;
  input:       unknown;
  timeout?:    number;      // ms
  assignedTo?: string;      // エージェントID
  createdAt:   number;
  startedAt?:  number;
  completedAt?: number;
}

/** タスク結果 */
export interface AgentTaskResult {
  taskId:      string;
  agentId:     string;
  success:     boolean;
  output:      unknown;
  error?:      string;
  durationMs:  number;
}

/** エージェント設定 */
export interface AgentConfig {
  id:          string;
  name:        string;
  role:        AgentRole;
  model?:      string;      // LLMモデル名（外部AIの場合）
  apiKey?:     string;
  maxConcurrent?: number;   // 同時実行タスク数上限
  timeout?:    number;      // デフォルトタイムアウト(ms)
}

// ============================================================
// BaseAgent — 全エージェントの基底クラス
// ============================================================

export abstract class BaseAgent extends EventEmitter {
  readonly id:     string;
  readonly name:   string;
  readonly role:   AgentRole;
  protected config: AgentConfig;

  private _status: AgentStatus = 'idle';
  private _taskQueue: AgentTask[] = [];
  private _runningTasks: Map<string, AgentTask> = new Map();
  private _messageLog: AgentMessage[] = [];

  constructor(config: AgentConfig) {
    super();
    this.config = config;
    this.id     = config.id;
    this.name   = config.name;
    this.role   = config.role;
  }

  // ----------------------------------------------------------
  // 状態管理
  // ----------------------------------------------------------

  get status(): AgentStatus { return this._status; }

  protected setStatus(s: AgentStatus): void {
    const prev = this._status;
    this._status = s;
    if (prev !== s) {
      this.emit('statusChange', { agentId: this.id, prev, current: s });
    }
  }

  get isAvailable(): boolean {
    return this._status === 'idle' || this._status === 'waiting';
  }

  get runningTaskCount(): number { return this._runningTasks.size; }

  // ----------------------------------------------------------
  // タスク処理
  // ----------------------------------------------------------

  /** タスクをキューに追加 */
  enqueue(task: AgentTask): void {
    this._taskQueue.push(task);
    this._taskQueue.sort((a, b) => {
      // 優先度順にソート（priorityはメッセージ側で管理、ここはFIFO）
      return a.createdAt - b.createdAt;
    });
    this.emit('taskQueued', { agentId: this.id, task });
  }

  /** 次のタスクを取り出して実行 */
  async processNext(): Promise<AgentTaskResult | null> {
    const maxConcurrent = this.config.maxConcurrent ?? 3;
    if (this._runningTasks.size >= maxConcurrent) return null;

    const task = this._taskQueue.shift();
    if (!task) return null;

    task.startedAt = Date.now();
    task.assignedTo = this.id;
    this._runningTasks.set(task.id, task);
    this.setStatus('running');

    this.emit('taskStart', { agentId: this.id, task });

    try {
      const timeout = task.timeout ?? this.config.timeout ?? 30_000;
      const output = await Promise.race([
        this.executeTask(task),
        this._timeoutPromise(timeout, task.id),
      ]);

      task.completedAt = Date.now();
      const result: AgentTaskResult = {
        taskId:     task.id,
        agentId:    this.id,
        success:    true,
        output,
        durationMs: task.completedAt - (task.startedAt ?? task.completedAt),
      };

      this._runningTasks.delete(task.id);
      if (this._runningTasks.size === 0) {
        this.setStatus(this._taskQueue.length > 0 ? 'running' : 'idle');
      }

      this.emit('taskComplete', { agentId: this.id, result });
      return result;

    } catch (err) {
      task.completedAt = Date.now();
      const result: AgentTaskResult = {
        taskId:     task.id,
        agentId:    this.id,
        success:    false,
        output:     null,
        error:      String(err),
        durationMs: task.completedAt - (task.startedAt ?? task.completedAt),
      };

      this._runningTasks.delete(task.id);
      this.setStatus('error');
      this.emit('taskError', { agentId: this.id, result });
      return result;
    }
  }

  /** タスク実行の具体的な実装（サブクラスで定義） */
  protected abstract executeTask(task: AgentTask): Promise<unknown>;

  // ----------------------------------------------------------
  // メッセージング
  // ----------------------------------------------------------

  /** メッセージを受信して処理 */
  receiveMessage(msg: AgentMessage): void {
    this._messageLog.push(msg);
    this.emit('message', msg);
    this.onMessage(msg);
  }

  /** メッセージ受信時の処理（サブクラスでオーバーライド可能） */
  protected onMessage(_msg: AgentMessage): void { /* デフォルトは何もしない */ }

  /** メッセージログを取得 */
  getMessageLog(): AgentMessage[] { return [...this._messageLog]; }

  // ----------------------------------------------------------
  // ライフサイクル
  // ----------------------------------------------------------

  /** エージェント起動 */
  async start(): Promise<void> {
    this.setStatus('idle');
    this.emit('start', { agentId: this.id });
  }

  /** エージェント停止 */
  async stop(): Promise<void> {
    this._taskQueue.length = 0;
    this.setStatus('suspended');
    this.emit('stop', { agentId: this.id });
  }

  /** エージェント状態サマリー */
  getSummary() {
    return {
      id:            this.id,
      name:          this.name,
      role:          this.role,
      status:        this._status,
      queueLength:   this._taskQueue.length,
      runningTasks:  this._runningTasks.size,
      messageCount:  this._messageLog.length,
    };
  }

  // ----------------------------------------------------------
  // ユーティリティ
  // ----------------------------------------------------------

  protected _timeoutPromise(ms: number, taskId: string): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`タスクタイムアウト(${ms}ms): ${taskId}`)), ms),
    );
  }

  protected _makeTaskId(): string {
    return `${this.id}_task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  protected _makeMsgId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }
}
