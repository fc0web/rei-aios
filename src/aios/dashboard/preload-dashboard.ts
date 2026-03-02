/**
 * Rei-AIOS テーマH — D-FUMTダッシュボード プリロード
 */

import { contextBridge, ipcRenderer } from 'electron';
import { DASHBOARD_IPC } from './types';

contextBridge.exposeInMainWorld('dashBridge', {
  // ダッシュボード準備完了通知（renderer → main）
  ready:        () => ipcRenderer.send(DASHBOARD_IPC.READY),
  // エンジン手動実行
  runEngine:    (input: number[]) => ipcRenderer.invoke(DASHBOARD_IPC.RUN_ENGINE, input),
  // メトリクスリセット
  resetMetrics: () => ipcRenderer.invoke(DASHBOARD_IPC.RESET_METRICS),
  // ウィンドウを閉じる
  close:        () => ipcRenderer.invoke(DASHBOARD_IPC.CLOSE),
  // 状態更新を受信
  onStateUpdate: (cb: (state: unknown) => void) =>
    ipcRenderer.on(DASHBOARD_IPC.STATE_UPDATE, (_e, d) => cb(d)),
});
