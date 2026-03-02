/**
 * Rei AIOS — Action Executor
 * Phase A: LLM 出力 → Rei スクリプト変換 → 実行
 *
 * D-FUMT 中心-周囲パターン:
 *   中心 = 単一の Rei コマンド（agent が出力した1行）
 *   周囲 = バリデーション / 安全性チェック / 実行コンテキスト
 *
 * [rei-aios 分離対応]
 *   parse / ReiRuntime / AutoController は interfaces 経由で注入。
 *   rei-automator 側が initReiAIOSDeps() で具象クラスを登録する。
 */

import { getReiAIOSDeps } from '../interfaces/rei-runtime-interface';

// ─── 型定義 ──────────────────────────────────────────

export interface ActionResult {
  success: boolean;
  command: string;
  elapsedMs: number;
  error?: string;
  rejectionReason?: string;
}

export interface ActionExecutorConfig {
  executionMode: 'cursor' | 'cursorless';
  defaultWindow?: string;
  dryRun: boolean;
  timeoutMs: number;
  log?: (msg: string) => void;
  mirrorHook?: (kind: 'click' | 'move' | 'type' | 'custom', command: string, meta?: { x?: number; y?: number }) => void;
}

const DEFAULT_CONFIG: ActionExecutorConfig = {
  executionMode: 'cursor',
  dryRun: false,
  timeoutMs: 30000,
};

// ─── 安全性チェック ──────────────────────────────────

const BLOCKED_PATTERNS: RegExp[] = [
  /format\s+[a-z]:/i,
  /del\s+\/[sfq]/i,
  /rmdir\s+\/s/i,
  /rm\s+-rf\s+\//i,
  /shutdown\s+/i,
  /taskkill\s+.*\/f/i,
  /reg\s+(delete|add).*\\hklm/i,
  /net\s+user\s+.*\/add/i,
  /netsh\s+firewall/i,
];

const WARN_PATTERNS: RegExp[] = [
  /launch\s+".*install/i,
  /hotkey\s+["']?alt\+f4/i,
  /key\s+delete/i,
];

// ─── ActionExecutor クラス ────────────────────────────

export class ActionExecutor {
  private config: ActionExecutorConfig;
  private log: (msg: string) => void;

  constructor(config?: Partial<ActionExecutorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.log = this.config.log || ((msg: string) => console.log(`[ActionExec] ${msg}`));
  }

  async execute(command: string): Promise<ActionResult> {
    const trimmed = command.trim();
    if (!trimmed) {
      return { success: false, command: '', elapsedMs: 0, error: 'Empty command' };
    }

    const rejection = this.validate(trimmed);
    if (rejection) {
      this.log(`BLOCKED: ${trimmed} — ${rejection}`);
      return { success: false, command: trimmed, elapsedMs: 0, rejectionReason: rejection };
    }

    for (const pat of WARN_PATTERNS) {
      if (pat.test(trimmed)) {
        this.log(`WARNING: potentially destructive command: ${trimmed}`);
        break;
      }
    }

    if (this.config.dryRun) {
      this.log(`DRY RUN: ${trimmed}`);
      return { success: true, command: trimmed, elapsedMs: 0 };
    }

    return this.executeReiCommand(trimmed);
  }

  validate(command: string): string | null {
    const deps = getReiAIOSDeps();
    for (const pat of BLOCKED_PATTERNS) {
      if (pat.test(command)) return `Blocked by safety rule: ${pat.source}`;
    }
    try {
      deps.parse(command);
    } catch (e: any) {
      return `Parse error: ${e.message}`;
    }
    return null;
  }

  async executeBlock(commands: string[]): Promise<ActionResult[]> {
    const results: ActionResult[] = [];
    for (const cmd of commands) {
      const result = await this.execute(cmd);
      results.push(result);
      if (!result.success) break;
    }
    return results;
  }

  // ─── Private ─────────────────────────────────────

  private async executeReiCommand(command: string): Promise<ActionResult> {
    const startTime = Date.now();
    const deps = getReiAIOSDeps();

    try {
      const program = deps.parse(command);
      const runtime = this.createRuntime();

      await Promise.race([
        runtime.execute(program),
        this.timeoutPromise(this.config.timeoutMs),
      ]);

      const elapsed = Date.now() - startTime;
      this.log(`OK (${elapsed}ms): ${command}`);
      this._notifyMirror(command);

      return { success: true, command, elapsedMs: elapsed };
    } catch (e: any) {
      const elapsed = Date.now() - startTime;
      this.log(`ERROR (${elapsed}ms): ${command} — ${e.message}`);
      return { success: false, command, elapsedMs: elapsed, error: e.message };
    }
  }

  private createRuntime(): any {
    const deps = getReiAIOSDeps();
    const backend = this._createStubBackend();
    const controller = deps.createController(backend);
    const runtime = deps.createRuntime(controller);

    if (this.config.executionMode === 'cursorless' && this.config.defaultWindow) {
      if (runtime.setExecutionMode) {
        runtime.setExecutionMode('cursorless', this.config.defaultWindow);
      }
    }

    return runtime;
  }

  private _createStubBackend(): any {
    const noop = async () => {};
    return {
      click: noop, dblclick: noop, rightclick: noop,
      move: noop, drag: noop, type: noop, key: noop, shortcut: noop,
    };
  }

  private timeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Execution timeout (${ms}ms)`)), ms);
    });
  }

  private _notifyMirror(command: string): void {
    const hook = this.config.mirrorHook;
    if (!hook) return;
    const clickMatch = /\bclick\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/i.exec(command);
    if (clickMatch) { hook('click', command, { x: parseFloat(clickMatch[1]), y: parseFloat(clickMatch[2]) }); return; }
    const moveMatch = /\bmove(?:To)?\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/i.exec(command);
    if (moveMatch) { hook('move', command, { x: parseFloat(moveMatch[1]), y: parseFloat(moveMatch[2]) }); return; }
    if (/\btype\s*\(/.test(command)) { hook('type', command); return; }
    hook('custom', command);
  }
}
