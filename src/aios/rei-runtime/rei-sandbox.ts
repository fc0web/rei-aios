/**
 * Rei-AIOS テーマH — ReiSandbox
 * ReiRuntime を AIOS 内で安全に実行するサンドボックス。
 *
 * 中心-周囲パターン:
 *   中心 = Rei スクリプトの単一コマンド実行
 *   周囲 = タイムアウト / ログ収集 / mirrorHook 通知
 *
 * [rei-aios 分離対応]
 *   parse / ReiRuntime / AutoController は interfaces 経由で注入。
 */

import { getReiAIOSDeps } from '../../interfaces/rei-runtime-interface';
import {
  SandboxConfig, DEFAULT_SANDBOX_CONFIG,
  ReiLogEntry, ScriptResult, ReplStatus, LogLevel,
} from './types';

let _logSeq = 0;
function makeLog(level: LogLevel, message: string, line?: number, command?: string): ReiLogEntry {
  return {
    id:        `log-${++_logSeq}`,
    timestamp: Date.now(),
    level, message, line, command,
  };
}

export class ReiSandbox {
  private config:    SandboxConfig;
  private onLog:     (entry: ReiLogEntry) => void;
  private onStatus:  (status: ReplStatus) => void;
  private mirrorHook?: (kind: string, command: string, meta?: { x?: number; y?: number }) => void;

  private abortFlag = false;
  private _status:  ReplStatus = 'idle';

  constructor(
    config?:     Partial<SandboxConfig>,
    onLog?:      (entry: ReiLogEntry) => void,
    onStatus?:   (status: ReplStatus) => void,
    mirrorHook?: (kind: string, command: string, meta?: { x?: number; y?: number }) => void,
  ) {
    this.config    = { ...DEFAULT_SANDBOX_CONFIG, ...config };
    this.onLog     = onLog     ?? (() => {});
    this.onStatus  = onStatus  ?? (() => {});
    this.mirrorHook = mirrorHook;
  }

  get status(): ReplStatus { return this._status; }

  abort(): void { this.abortFlag = true; }

  // ──────────────────────────────────────────────────────────
  // スクリプト実行
  // ──────────────────────────────────────────────────────────

  async runScript(sessionId: string, script: string): Promise<ScriptResult> {
    this.abortFlag = false;
    this._setStatus('running');

    const startTime = Date.now();
    const logs:     ReiLogEntry[] = [];
    let lineCount   = 0;
    let errorCount  = 0;

    const addLog = (level: LogLevel, msg: string, line?: number, cmd?: string) => {
      const entry = makeLog(level, msg, line, cmd);
      logs.push(entry);
      this.onLog(entry);
    };

    addLog('info', `スクリプト実行開始 (${script.split('\n').length} 行)`);

    const lines = script
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('//') && !l.startsWith('#'));

    if (lines.length > this.config.maxCommands) {
      addLog('warn', `コマンド数が上限(${this.config.maxCommands})を超えています。最初の${this.config.maxCommands}行のみ実行します。`);
    }

    const execLines = lines.slice(0, this.config.maxCommands);

    for (let i = 0; i < execLines.length; i++) {
      if (this.abortFlag) {
        addLog('warn', '実行が中断されました');
        break;
      }

      const cmd = execLines[i];
      lineCount++;

      const deps = getReiAIOSDeps();

      // パース検証
      try {
        deps.parse(cmd);
      } catch (e: any) {
        errorCount++;
        addLog('error', `パースエラー [行${i + 1}]: ${e.message}`, i + 1, cmd);
        continue;
      }

      // mirrorHook 通知
      if (this.mirrorHook && this.config.enableMirror) {
        this._notifyMirror(cmd);
      }

      // ドライランの場合は実行せずにログだけ
      if (this.config.dryRun) {
        addLog('info', `[DRY] ${cmd}`, i + 1, cmd);
        continue;
      }

      // 実際の実行
      try {
        await Promise.race([
          this._execOne(cmd, i + 1, addLog),
          this._timeout(this.config.timeoutMs, cmd),
        ]);
        addLog('result', `✓ [行${i + 1}] ${cmd}`, i + 1, cmd);
      } catch (e: any) {
        errorCount++;
        addLog('error', `✗ [行${i + 1}] ${cmd} — ${e.message}`, i + 1, cmd);
      }
    }

    const elapsed = Date.now() - startTime;
    addLog('info', `完了 | 実行: ${lineCount} 行 | エラー: ${errorCount} 件 | ${elapsed}ms`);

    this._setStatus(errorCount > 0 ? 'error' : 'idle');

    return { sessionId, success: errorCount === 0, lineCount, errorCount, elapsedMs: elapsed, logs };
  }

  // ──────────────────────────────────────────────────────────
  // Private
  // ──────────────────────────────────────────────────────────

  private async _execOne(
    cmd: string,
    lineNum: number,
    addLog: (level: LogLevel, msg: string, line?: number, cmd?: string) => void,
  ): Promise<void> {
    const deps = getReiAIOSDeps();
    const program = deps.parse(cmd);

    // スタブバックエンド（rei-aios 単体では実バックエンドを持たない）
    const noop = async () => {};
    const backend = {
      click: noop, dblclick: noop, rightclick: noop,
      move: noop, drag: noop, type: noop, key: noop, shortcut: noop,
    };

    const controller = deps.createController(backend);
    const runtime = deps.createRuntime(controller);

    if (runtime.setContext) {
      runtime.setContext({
        running: true, paused: false, currentLine: lineNum,
        onLog:          (msg: string) => addLog('info', msg, lineNum, cmd),
        onStatusChange: () => {},
        onLineExecute:  () => {},
      });
    }

    await runtime.execute(program);
  }

  private _timeout(ms: number, cmd: string): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`タイムアウト (${ms}ms): ${cmd}`)), ms),
    );
  }

  private _setStatus(s: ReplStatus): void {
    this._status = s;
    this.onStatus(s);
  }

  private _notifyMirror(command: string): void {
    const hook = this.mirrorHook;
    if (!hook) return;
    const clickMatch = /\bclick\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/i.exec(command);
    if (clickMatch) { hook('click', command, { x: parseFloat(clickMatch[1]), y: parseFloat(clickMatch[2]) }); return; }
    const moveMatch  = /\bmove(?:To)?\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/i.exec(command);
    if (moveMatch)  { hook('move', command,  { x: parseFloat(moveMatch[1]),  y: parseFloat(moveMatch[2])  }); return; }
    if (/\btype\s*\(/.test(command)) { hook('type', command); return; }
    hook('custom', command);
  }
}
