import { contextBridge, ipcRenderer } from 'electron';
import { MIRROR_IPC } from './types';

contextBridge.exposeInMainWorld('mirrorBridge', {
  ready:            () => ipcRenderer.send(MIRROR_IPC.READY),
  onCursorBatch:    (cb: (c: unknown[]) => void) =>
    ipcRenderer.on(MIRROR_IPC.CURSOR_BATCH,    (_e, d) => cb(d)),
  onActionEvent:    (cb: (e: unknown) => void) =>
    ipcRenderer.on(MIRROR_IPC.ACTION_EVENT,    (_e, d) => cb(d)),
  onConfigUpdate:   (cb: (c: unknown) => void) =>
    ipcRenderer.on(MIRROR_IPC.CONFIG_UPDATE,   (_e, d) => cb(d)),
  onReflectionSync: (cb: (u: string) => void) =>
    ipcRenderer.on(MIRROR_IPC.REFLECTION_SYNC, (_e, d) => cb(d)),
  onWindowClose:    (cb: () => void) =>
    ipcRenderer.on(MIRROR_IPC.WINDOW_CLOSE,    () => cb()),
});
