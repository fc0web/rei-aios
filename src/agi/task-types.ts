// ============================================================
// Rei-AIOS AGI Layer — Phase 1: Task Types
// src/agi/task-types.ts
// ============================================================

/** サブタスクのタイプ */
export type TaskType =
  | 'search'      // Web検索・ローカル検索
  | 'file_op'     // ファイル読み書き・編集
  | 'browser'     // ブラウザ操作
  | 'compute'     // 計算・データ処理
  | 'summarize'   // 情報の要約・整理
  | 'code_gen'    // コード生成（Rei言語含む）
  | 'automation'  // PC自動化（既存Reiスクリプト実行）
  | 'excel'       // Excel操作
  | 'vision';     // 画面認識・Vision

/** サブタスクの実行状態 */
export type TaskStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

/** 個々のサブタスク */
export interface SubTask {
  id: string;
  type: TaskType;
  description: string;
  dependencies: string[];       // 先行タスクのID
  status: TaskStatus;
  result?: any;
  error?: string;
  startedAt?: number;
  completedAt?: number;
  retryCount: number;
}

/** タスク計画全体 */
export interface TaskPlan {
  id: string;
  originalQuery: string;        // ユーザーの元の指示
  subtasks: SubTask[];
  createdAt: number;
  completedAt?: number;
  status: 'planning' | 'executing' | 'done' | 'failed';
}

/** タスク実行結果 */
export interface TaskResult {
  taskId: string;
  success: boolean;
  data?: any;
  error?: string;
  duration: number;             // ms
}

/** タスクプランナーのLLM応答形式 */
export interface PlannerResponse {
  subtasks: {
    id: string;
    type: TaskType;
    description: string;
    dependencies: string[];
  }[];
}

/** タスク実行ログエントリ */
export interface TaskLogEntry {
  timestamp: number;
  planId: string;
  taskId: string;
  event: 'start' | 'done' | 'fail' | 'retry' | 'skip';
  message: string;
}

/** Phase 1 設定 */
export interface AGIConfig {
  enabled: boolean;
  maxRetries: number;           // タスク失敗時の最大リトライ回数
  maxSubtasks: number;          // 1プランあたりの最大サブタスク数
  timeoutMs: number;            // サブタスクのタイムアウト（ms）
  logPath: string;              // ログ保存先
}

/** デフォルト設定 */
export const DEFAULT_AGI_CONFIG: AGIConfig = {
  enabled: false,
  maxRetries: 2,
  maxSubtasks: 10,
  timeoutMs: 30000,
  logPath: './data/agi-log.json'
};
