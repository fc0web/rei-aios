/**
 * Rei-AIOS テーマH — ReiREPL
 * 複数の Rei スクリプト実行セッションを管理する。
 * IPC ハンドラー登録と BrowserWindow へのログストリーム配信を担う。
 */

import { BrowserWindow, ipcMain } from 'electron';
// crypto.randomUUID() を使用（uuid依存を排除）
const uuidv4 = () => require('crypto').randomUUID() as string;
import {
  ReplSession, ReplSummary, ReplStatus, ReiLogEntry,
  ScriptResult, SandboxConfig, REI_REPL_IPC,
} from './types';
import { ReiSandbox } from './rei-sandbox';

export class ReiREPL {
  private sessions: Map<string, { session: ReplSession; sandbox: ReiSandbox }>;
  private mainWin:  BrowserWindow;
  private sandboxConfig: Partial<SandboxConfig>;
  private mirrorHook?: (kind: string, command: string, meta?: { x?: number; y?: number }) => void;

  constructor(
    mainWindow: BrowserWindow,
    sandboxConfig?: Partial<SandboxConfig>,
    mirrorHook?: (kind: string, command: string, meta?: { x?: number; y?: number }) => void,
  ) {
    this.sessions      = new Map();
    this.mainWin       = mainWindow;
    this.sandboxConfig = sandboxConfig ?? {};
    this.mirrorHook    = mirrorHook;
  }

  // ──────────────────────────────────────────────────────────
  // IPC ハンドラー登録
  // ──────────────────────────────────────────────────────────

  registerIpcHandlers(): void {
    ipcMain.handle(REI_REPL_IPC.CREATE_SESSION, (_e, name?: string) => {
      return this.createSession(name);
    });

    ipcMain.handle(REI_REPL_IPC.DESTROY_SESSION, (_e, sessionId: string) => {
      return this.destroySession(sessionId);
    });

    ipcMain.handle(REI_REPL_IPC.LIST_SESSIONS, () => {
      return this.listSessions();
    });

    ipcMain.handle(REI_REPL_IPC.RUN_SCRIPT, async (_e, sessionId: string, script: string) => {
      return await this.runScript(sessionId, script);
    });

    ipcMain.handle(REI_REPL_IPC.ABORT, (_e, sessionId: string) => {
      this.abort(sessionId);
      return { ok: true };
    });
  }

  // ──────────────────────────────────────────────────────────
  // セッション管理
  // ──────────────────────────────────────────────────────────

  createSession(name?: string): ReplSession {
    const id  = uuidv4();
    const now = Date.now();
    const session: ReplSession = {
      id,
      name:         name ?? `Session #${this.sessions.size + 1}`,
      createdAt:    now,
      lastActiveAt: now,
      status:       'idle',
      logs:         [],
      lineCount:    0,
      errorCount:   0,
      script:       '',
    };

    const sandbox = new ReiSandbox(
      this.sandboxConfig,
      (entry: ReiLogEntry) => {
        session.logs.push(entry);
        if (session.logs.length > (this.sandboxConfig.maxLogs ?? 500)) {
          session.logs.shift();
        }
        // BrowserWindow へストリーム配信
        this._sendToRenderer(REI_REPL_IPC.LOG_ENTRY, { sessionId: id, entry });
      },
      (status: ReplStatus) => {
        session.status      = status;
        session.lastActiveAt = Date.now();
        this._sendToRenderer(REI_REPL_IPC.SESSION_STATUS, { sessionId: id, status });
      },
      this.mirrorHook,
    );

    this.sessions.set(id, { session, sandbox });
    return session;
  }

  destroySession(sessionId: string): { ok: boolean } {
    const entry = this.sessions.get(sessionId);
    if (entry) {
      entry.sandbox.abort();
      this.sessions.delete(sessionId);
    }
    return { ok: true };
  }

  listSessions(): ReplSummary[] {
    return Array.from(this.sessions.values()).map(({ session }) => ({
      id:          session.id,
      name:        session.name,
      status:      session.status,
      lastActiveAt:session.lastActiveAt,
      lineCount:   session.lineCount,
    }));
  }

  abort(sessionId: string): void {
    this.sessions.get(sessionId)?.sandbox.abort();
  }

  // ──────────────────────────────────────────────────────────
  // スクリプト実行
  // ──────────────────────────────────────────────────────────

  async runScript(sessionId: string, script: string): Promise<ScriptResult> {
    const entry = this.sessions.get(sessionId);
    if (!entry) {
      // セッションが存在しない場合は自動生成
      const session = this.createSession();
      return this.runScript(session.id, script);
    }

    const { session, sandbox } = entry;
    session.script      = script;
    session.lastActiveAt = Date.now();

    const result = await sandbox.runScript(sessionId, script);

    session.lineCount  += result.lineCount;
    session.errorCount += result.errorCount;

    return result;
  }

  // ──────────────────────────────────────────────────────────
  // 便利: デフォルトセッションで即時実行
  // ──────────────────────────────────────────────────────────

  async quickRun(script: string): Promise<ScriptResult> {
    let defaultId = [...this.sessions.keys()][0];
    if (!defaultId) {
      const s = this.createSession('default');
      defaultId = s.id;
    }
    return this.runScript(defaultId, script);
  }

  // ──────────────────────────────────────────────────────────
  // Private
  // ──────────────────────────────────────────────────────────

  private _sendToRenderer(channel: string, data: unknown): void {
    if (!this.mainWin.isDestroyed()) {
      this.mainWin.webContents.send(channel, data);
    }
  }
}
