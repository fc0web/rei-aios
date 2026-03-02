/**
 * Rei-AIOS Shell — プリロードスクリプト (preload-shell.ts)
 * レンダラーからメインプロセスへの安全な橋渡し
 */

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('reiShell', {
  // シェル情報
  getInfo:      ()                              => ipcRenderer.invoke('shell:info'),
  // ウィンドウ操作
  window:       (action: string)                => ipcRenderer.invoke('shell:window', action),
  isFullscreen: ()                              => ipcRenderer.invoke('shell:isFullscreen'),
  restart:      ()                              => ipcRenderer.invoke('shell:restart'),
  // ログ
  log:          (msg: string, level?: string)   => ipcRenderer.invoke('shell:log', msg, level),
  // 設定
  getConfig:    ()                              => ipcRenderer.invoke('shell:getConfig'),
  setConfig:    (cfg: Record<string, unknown>)  => ipcRenderer.invoke('shell:setConfig', cfg),
  // ── テーマG: 合わせ鏡 UI ──────────────────────────────
  openMirror:    (cfg?: Record<string, unknown>) => ipcRenderer.invoke('mirror:open', cfg),
  closeMirror:   ()                              => ipcRenderer.invoke('mirror:close'),
  setMirrorMode: (mode: string)                  => ipcRenderer.invoke('mirror:set-mode', mode),
  setMirrorDepth:(depth: number)                 => ipcRenderer.invoke('mirror:set-depth', depth),
  onMirrorClosed:(cb: () => void)                => ipcRenderer.on('mirror:closed', cb),
  // ── テーマH: D-FUMTダッシュボード ──────────────────────
  openDashboard:      ()               => ipcRenderer.invoke('dashboard:open'),
  closeDashboard:     ()               => ipcRenderer.invoke('dashboard:close'),
  onDashboardClosed:  (cb: () => void) => ipcRenderer.on('dashboard:closed', cb),
  // ── テーマH: Rei REPL ────────────────────────────────
  reiCreateSession:   (name?: string)                  => ipcRenderer.invoke('rei-repl:create-session', name),
  reiDestroySession:  (id: string)                     => ipcRenderer.invoke('rei-repl:destroy-session', id),
  reiListSessions:    ()                               => ipcRenderer.invoke('rei-repl:list-sessions'),
  reiRunScript:       (id: string, script: string)     => ipcRenderer.invoke('rei-repl:run-script', id, script),
  reiAbort:           (id: string)                     => ipcRenderer.invoke('rei-repl:abort', id),
  onReiLog:           (cb: (data: unknown) => void)    => ipcRenderer.on('rei-repl:log-entry',    (_e, d) => cb(d)),
  onReiStatus:        (cb: (data: unknown) => void)    => ipcRenderer.on('rei-repl:session-status',(_e, d) => cb(d)),
  // ── テーマI: 数学知識ネットワーク統合 ──────────────────
  openKnowledge:      ()                               => ipcRenderer.invoke('knowledge:open'),
  closeKnowledge:     ()                               => ipcRenderer.invoke('knowledge:close'),
  onKnowledgeClosed:  (cb: () => void)                 => ipcRenderer.on('knowledge:closed', cb),
});
