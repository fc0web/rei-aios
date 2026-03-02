/**
 * Rei-AIOS テーマH — Rei言語ランタイム統合 型定義
 */

// ============================================================
// 実行ログ
// ============================================================

export type LogLevel = 'info' | 'warn' | 'error' | 'result';

export interface ReiLogEntry {
  id:        string;
  timestamp: number;
  level:     LogLevel;
  message:   string;
  line?:     number;    // 実行行番号
  command?:  string;    // 実行コマンド
}

// ============================================================
// REPLセッション
// ============================================================

export type ReplStatus = 'idle' | 'running' | 'paused' | 'error';

export interface ReplSession {
  id:         string;
  name:       string;
  createdAt:  number;
  lastActiveAt: number;
  status:     ReplStatus;
  logs:       ReiLogEntry[];
  lineCount:  number;
  errorCount: number;
  script:     string;   // 最後に実行したスクリプト
}

export interface ReplSummary {
  id:         string;
  name:       string;
  status:     ReplStatus;
  lastActiveAt: number;
  lineCount:  number;
}

// ============================================================
// サンドボックス設定
// ============================================================

export interface SandboxConfig {
  /** タイムアウト ms（デフォルト: 15000） */
  timeoutMs:      number;
  /** ドライラン（実際には操作しない） */
  dryRun:         boolean;
  /** 1スクリプト内の最大コマンド数 */
  maxCommands:    number;
  /** ログ保持件数 */
  maxLogs:        number;
  /** mirrorHook 経由で合わせ鏡へ通知するか */
  enableMirror:   boolean;
}

export const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  timeoutMs:    15000,
  dryRun:       false,
  maxCommands:  200,
  maxLogs:      500,
  enableMirror: true,
};

// ============================================================
// 実行結果
// ============================================================

export interface ScriptResult {
  sessionId:  string;
  success:    boolean;
  lineCount:  number;
  errorCount: number;
  elapsedMs:  number;
  logs:       ReiLogEntry[];
  error?:     string;
}

// ============================================================
// IPC チャンネル定数
// ============================================================

export const REI_REPL_IPC = {
  // セッション管理
  CREATE_SESSION:  'rei-repl:create-session',
  DESTROY_SESSION: 'rei-repl:destroy-session',
  LIST_SESSIONS:   'rei-repl:list-sessions',
  // 実行
  RUN_SCRIPT:      'rei-repl:run-script',
  ABORT:           'rei-repl:abort',
  // ログストリーム
  LOG_ENTRY:       'rei-repl:log-entry',    // main → renderer
  // 状態
  SESSION_STATUS:  'rei-repl:session-status',
} as const;
