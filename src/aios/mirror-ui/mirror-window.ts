import { BrowserWindow, ipcMain, screen } from 'electron';
import * as path from 'path';
import { MIRROR_IPC, MirrorConfig, DEFAULT_MIRROR_CONFIG,
         MirrorCursorState, MirrorActionEvent } from './types';

export class MirrorWindowManager {
  private mirrorWin: BrowserWindow | null = null;
  private mainWin:   BrowserWindow;
  private config:    MirrorConfig = { ...DEFAULT_MIRROR_CONFIG };
  private readonly PRELOAD_PATH: string;
  private readonly MIRROR_HTML:  string;

  constructor(mainWindow: BrowserWindow) {
    this.mainWin      = mainWindow;
    this.PRELOAD_PATH = path.join(__dirname, 'preload-mirror.js');
    this.MIRROR_HTML  = path.join(__dirname, '../../src/aios/mirror-ui/mirror.html');
  }

  registerIpcHandlers(): void {
    ipcMain.handle(MIRROR_IPC.OPEN_MIRROR,  async (_e, cfg?: Partial<MirrorConfig>) => {
      if (cfg) Object.assign(this.config, cfg);
      await this.open(); return { ok: true };
    });
    ipcMain.handle(MIRROR_IPC.CLOSE_MIRROR, async () => { this.close(); return { ok: true }; });
    ipcMain.handle(MIRROR_IPC.SET_MODE,  (_e, mode)  => {
      this.config.mode  = mode;  this._send(MIRROR_IPC.CONFIG_UPDATE, this.config);
    });
    ipcMain.handle(MIRROR_IPC.SET_DEPTH, (_e, depth) => {
      this.config.depth = depth; this._send(MIRROR_IPC.CONFIG_UPDATE, this.config);
    });
    ipcMain.on(MIRROR_IPC.CURSOR_BATCH,    (_e, d) => this._send(MIRROR_IPC.CURSOR_BATCH,    d));
    ipcMain.on(MIRROR_IPC.ACTION_EVENT,    (_e, d) => this._send(MIRROR_IPC.ACTION_EVENT,    d));
    ipcMain.on(MIRROR_IPC.REFLECTION_SYNC, (_e, d) => this._send(MIRROR_IPC.REFLECTION_SYNC, d));
  }

  async open(): Promise<void> {
    if (this.mirrorWin && !this.mirrorWin.isDestroyed()) { this.mirrorWin.focus(); return; }
    const p = this._placement();
    this.mirrorWin = new BrowserWindow({
      width: this.config.windowWidth, height: this.config.windowHeight,
      x: p.x, y: p.y, frame: false, titleBarStyle: 'hidden',
      backgroundColor: '#06060b', resizable: true, movable: true,
      title: 'Rei-AIOS Mirror',
      webPreferences: {
        preload: this.PRELOAD_PATH, contextIsolation: true,
        nodeIntegration: false, sandbox: false, webSecurity: true,
      },
    });
    this.mirrorWin.loadFile(this.MIRROR_HTML);
    ipcMain.once(MIRROR_IPC.READY, () => this._send(MIRROR_IPC.CONFIG_UPDATE, this.config));
    this.mirrorWin.on('closed', () => {
      this.mirrorWin = null;
      this.mainWin.webContents.send(MIRROR_IPC.CLOSED);
    });
  }

  close(): void {
    if (this.mirrorWin && !this.mirrorWin.isDestroyed()) this.mirrorWin.close();
    this.mirrorWin = null;
  }

  isOpen(): boolean { return !!this.mirrorWin && !this.mirrorWin.isDestroyed(); }

  /**
   * テーマG: アクションイベントを合わせ鏡ウィンドウへ送信
   * ActionExecutor の mirrorHook から呼び出される。
   */
  notifyAction(kind: string, command: string, meta?: { x?: number; y?: number }): void {
    if (!this.isOpen()) return;
    const event = {
      id: `act-${Date.now()}`,
      agentId: 'rei-executor',
      kind: kind as any,
      label: command.length > 40 ? command.slice(0, 40) + '…' : command,
      timestamp: Date.now(),
      ...meta,
    };
    this._send('mirror:action-event', event);
  }

  private _send(ch: string, d: unknown): void {
    if (this.mirrorWin && !this.mirrorWin.isDestroyed())
      this.mirrorWin.webContents.send(ch, d);
  }

  private _placement(): { x: number; y: number } {
    const displays = screen.getAllDisplays();
    const mb = this.mainWin.getBounds();
    if (displays.length >= 2) {
      const sec = displays.find(d =>
        d.id !== screen.getDisplayNearestPoint({ x: mb.x, y: mb.y }).id
      ) ?? displays[1];
      return { x: sec.bounds.x, y: sec.bounds.y };
    }
    return { x: mb.x + mb.width + 8, y: mb.y };
  }
}
