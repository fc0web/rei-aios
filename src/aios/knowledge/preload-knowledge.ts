/**
 * Rei-AIOS テーマI — Knowledge プリロード
 */
import { contextBridge, ipcRenderer } from 'electron';
import { KNOWLEDGE_IPC } from './types';

contextBridge.exposeInMainWorld('knowledgeBridge', {
  ready:       () => ipcRenderer.send(KNOWLEDGE_IPC.READY),
  close:       () => ipcRenderer.invoke(KNOWLEDGE_IPC.CLOSE),
  // arXiv
  fetchArxiv:  (opts: unknown) => ipcRenderer.invoke(KNOWLEDGE_IPC.FETCH_ARXIV, opts),
  // OEIS
  fetchOeis:   (opts: unknown) => ipcRenderer.invoke(KNOWLEDGE_IPC.FETCH_OEIS, opts),
  // シミュレーター
  runSim:      (params: unknown) => ipcRenderer.invoke(KNOWLEDGE_IPC.RUN_SIM, params),
  // D-FUMTエンジン
  runDfumt:    (vector: number[]) => ipcRenderer.invoke(KNOWLEDGE_IPC.RUN_DFUMT, vector),
  // 状態更新受信
  onStateUpdate: (cb: (s: unknown) => void) =>
    ipcRenderer.on(KNOWLEDGE_IPC.STATE_UPDATE, (_e, d) => cb(d)),
});
