/**
 * Rei AIOS — Update Notifier (Electron IPC ブリッジ)
 * Phase 4: 自動更新 UI通知
 *
 * AIOSUpdater のイベントを Electron の ipcMain/ipcRenderer に橋渡しする。
 * メインウィンドウに更新バナーを表示し、ユーザーが承認したらダウンロード開始。
 */

import type { BrowserWindow, IpcMain } from 'electron';
import { AIOSUpdater, ReleaseInfo, UpdateCheckResult } from './updater';

// ─── IPC チャネル名 ─────────────────────────────────

export const UPDATE_CHANNELS = {
  // Main → Renderer
  STATE_CHANGED:      'aios:update:state-changed',
  AVAILABLE:          'aios:update:available',
  NOT_AVAILABLE:      'aios:update:not-available',
  DOWNLOAD_PROGRESS:  'aios:update:download-progress',
  DOWNLOADED:         'aios:update:downloaded',
  ERROR:              'aios:update:error',
  // Renderer → Main
  CHECK_NOW:          'aios:update:check-now',
  START_DOWNLOAD:     'aios:update:start-download',
  INSTALL_AND_RELAUNCH: 'aios:update:install',
} as const;

// ─── registerUpdateHandlers ───────────────────────────

/**
 * main.ts から呼ぶ。
 * IPC ハンドラーを登録し、Updater イベントをウィンドウへ転送する。
 */
export function registerUpdateHandlers(
  ipcMain: IpcMain,
  updater: AIOSUpdater,
  getMainWindow: () => BrowserWindow | null
): void {
  let pendingRelease: ReleaseInfo | null = null;

  // ─── Updater → Renderer 転送 ────────────────────

  updater.on('state-changed', (state) => {
    getMainWindow()?.webContents.send(UPDATE_CHANNELS.STATE_CHANGED, state);
  });

  updater.on('update-available', (release) => {
    pendingRelease = release;
    getMainWindow()?.webContents.send(UPDATE_CHANNELS.AVAILABLE, {
      version: release.version,
      name: release.name,
      body: release.body,
      publishedAt: release.publishedAt,
      htmlUrl: release.htmlUrl,
      size: release.size,
      isPrerelease: release.isPrerelease,
    });
  });

  updater.on('update-not-available', (current) => {
    getMainWindow()?.webContents.send(UPDATE_CHANNELS.NOT_AVAILABLE, { current });
  });

  updater.on('download-progress', (percent, bps, total) => {
    getMainWindow()?.webContents.send(UPDATE_CHANNELS.DOWNLOAD_PROGRESS, {
      percent, bps, total,
      downloaded: Math.round(total * percent / 100),
    });
  });

  updater.on('update-downloaded', (localPath, release) => {
    getMainWindow()?.webContents.send(UPDATE_CHANNELS.DOWNLOADED, {
      localPath,
      version: release.version,
    });
  });

  updater.on('error', (err) => {
    getMainWindow()?.webContents.send(UPDATE_CHANNELS.ERROR, {
      message: err.message,
    });
  });

  // ─── Renderer → Updater ─────────────────────────

  ipcMain.handle(UPDATE_CHANNELS.CHECK_NOW, async (): Promise<UpdateCheckResult> => {
    return updater.checkForUpdates();
  });

  ipcMain.handle(UPDATE_CHANNELS.START_DOWNLOAD, async (): Promise<{ success: boolean; error?: string }> => {
    if (!pendingRelease) {
      return { success: false, error: 'No update available' };
    }
    try {
      await updater.downloadUpdate(pendingRelease);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.on(UPDATE_CHANNELS.INSTALL_AND_RELAUNCH, () => {
    // Electron でのアプリ再起動
    // 実際の install は electron-builder の autoUpdater.quitAndInstall() が担当
    // ここでは zip 解凍→再起動の簡易版
    try {
      const { app } = require('electron');
      app.relaunch();
      app.exit(0);
    } catch (err) {
      console.error('[UpdateNotifier] Relaunch failed:', err);
    }
  });
}

// ─── preload 側のコード (preload-update-additions.ts) ─

/**
 * このコメントブロックを `src/main/preload-update-additions.ts` として配置し、
 * preload.ts で import すること。
 *
 * ```typescript
 * import { contextBridge, ipcRenderer } from 'electron';
 * import { UPDATE_CHANNELS } from '../aios/auto-update/update-notifier';
 *
 * contextBridge.exposeInMainWorld('updateAPI', {
 *   checkNow:          () => ipcRenderer.invoke(UPDATE_CHANNELS.CHECK_NOW),
 *   startDownload:     () => ipcRenderer.invoke(UPDATE_CHANNELS.START_DOWNLOAD),
 *   installAndRelaunch:() => ipcRenderer.send(UPDATE_CHANNELS.INSTALL_AND_RELAUNCH),
 *
 *   onStateChanged:       (cb: (s: string) => void) =>
 *     ipcRenderer.on(UPDATE_CHANNELS.STATE_CHANGED, (_, s) => cb(s)),
 *   onAvailable:          (cb: (r: any) => void) =>
 *     ipcRenderer.on(UPDATE_CHANNELS.AVAILABLE, (_, r) => cb(r)),
 *   onNotAvailable:       (cb: (info: any) => void) =>
 *     ipcRenderer.on(UPDATE_CHANNELS.NOT_AVAILABLE, (_, info) => cb(info)),
 *   onDownloadProgress:   (cb: (p: any) => void) =>
 *     ipcRenderer.on(UPDATE_CHANNELS.DOWNLOAD_PROGRESS, (_, p) => cb(p)),
 *   onDownloaded:         (cb: (info: any) => void) =>
 *     ipcRenderer.on(UPDATE_CHANNELS.DOWNLOADED, (_, info) => cb(info)),
 *   onError:              (cb: (err: any) => void) =>
 *     ipcRenderer.on(UPDATE_CHANNELS.ERROR, (_, err) => cb(err)),
 * });
 * ```
 */
export const PRELOAD_TEMPLATE = '// See JSDoc above for preload-update-additions.ts content';
