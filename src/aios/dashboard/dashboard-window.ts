/**
 * Rei-AIOS テーマH — DashboardWindowManager
 * D-FUMTダッシュボードウィンドウの生成・IPC管理
 */

import { BrowserWindow, ipcMain, screen } from 'electron';
import * as path from 'path';
import { DASHBOARD_IPC, DashboardState } from './types';
import { DFUMTMonitor } from './dfumt-monitor';

export class DashboardWindowManager {
  private dashWin:  BrowserWindow | null = null;
  private mainWin:  BrowserWindow;
  private monitor:  DFUMTMonitor;
  private readonly PRELOAD_PATH: string;
  private readonly HTML_PATH:    string;

  constructor(mainWindow: BrowserWindow) {
    this.mainWin     = mainWindow;
    this.PRELOAD_PATH = path.join(__dirname, 'preload-dashboard.js');
    this.HTML_PATH    = path.join(__dirname, '../../src/aios/dashboard/dashboard.html');

    this.monitor = new DFUMTMonitor(2000, (state: DashboardState) => {
      this._send(DASHBOARD_IPC.STATE_UPDATE, state);
    });
  }

  registerIpcHandlers(): void {
    ipcMain.handle(DASHBOARD_IPC.OPEN, async () => {
      await this.open(); return { ok: true };
    });
    ipcMain.handle(DASHBOARD_IPC.CLOSE, () => {
      this.close(); return { ok: true };
    });
    ipcMain.handle(DASHBOARD_IPC.RUN_ENGINE, (_e, input: number[]) => {
      const snap = this.monitor.runWith(input);
      return snap;
    });
    ipcMain.handle(DASHBOARD_IPC.RESET_METRICS, () => {
      this.monitor.resetMetrics(); return { ok: true };
    });
    ipcMain.on(DASHBOARD_IPC.READY, () => {
      // ダッシュボード準備完了 → 現在状態を即時送信してモニター開始
      this._send(DASHBOARD_IPC.STATE_UPDATE, this.monitor.getState());
      if (!this.monitor.isRunning()) this.monitor.start();
    });
  }

  async open(): Promise<void> {
    if (this.dashWin && !this.dashWin.isDestroyed()) { this.dashWin.focus(); return; }

    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    const mb = this.mainWin.getBounds();

    this.dashWin = new BrowserWindow({
      width:  Math.min(1100, width - 80),
      height: Math.min(760, height - 80),
      x: Math.max(0, mb.x + 40),
      y: Math.max(0, mb.y + 40),
      frame: false,
      titleBarStyle: 'hidden',
      backgroundColor: '#06060b',
      resizable: true,
      movable: true,
      title: 'D-FUMT Dashboard',
      webPreferences: {
        preload: this.PRELOAD_PATH,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        webSecurity: true,
      },
    });

    this.dashWin.loadFile(this.HTML_PATH);

    this.dashWin.on('closed', () => {
      this.monitor.stop();
      this.dashWin = null;
      this.mainWin.webContents.send(DASHBOARD_IPC.CLOSED);
    });
  }

  close(): void {
    this.monitor.stop();
    if (this.dashWin && !this.dashWin.isDestroyed()) this.dashWin.close();
    this.dashWin = null;
  }

  isOpen(): boolean { return !!this.dashWin && !this.dashWin.isDestroyed(); }

  private _send(ch: string, d: unknown): void {
    if (this.dashWin && !this.dashWin.isDestroyed())
      this.dashWin.webContents.send(ch, d);
  }
}
