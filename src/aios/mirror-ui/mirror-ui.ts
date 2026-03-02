import { MIRROR_IPC, MirrorConfig, MirrorCursorState,
         MirrorActionEvent, MirrorMode, ReflectionDepth,
         DEFAULT_MIRROR_CONFIG } from './types';

interface ICursorLayer {
  renderer: { getAll(): Array<{
    id: string; config: { label: string; color: string; type: string };
    x: number; y: number; state: string; visible: boolean;
    trail: Array<{ x: number; y: number }>;
  }>; };
  startMirrorMode(s?: string, m?: string): void;
  stopMirrorMode(): void;
}

export class MirrorUI {
  private layer:      ICursorLayer;
  private config:     MirrorConfig = { ...DEFAULT_MIRROR_CONFIG };
  private syncRafId:  number | null = null;
  private actionSeq:  number = 0;
  private _isOpen:    boolean = false;

  constructor(layer: ICursorLayer) {
    this.layer = layer;
    (window as any).electronAPI?.on(MIRROR_IPC.CLOSED, () => {
      this._stopSync(); this._isOpen = false; this.layer.stopMirrorMode();
    });
  }

  async open(cfg?: Partial<MirrorConfig>): Promise<void> {
    if (cfg) Object.assign(this.config, cfg);
    await (window as any).electronAPI?.invoke(MIRROR_IPC.OPEN_MIRROR, this.config);
    this._isOpen = true;
    this.layer.startMirrorMode('rei-agent', 'dfumt-agent');
    this._startSync();
  }

  async close(): Promise<void> {
    this._stopSync(); this.layer.stopMirrorMode();
    await (window as any).electronAPI?.invoke(MIRROR_IPC.CLOSE_MIRROR);
    this._isOpen = false;
  }

  get isOpen(): boolean { return this._isOpen; }

  setMode(mode: MirrorMode): void {
    this.config.mode = mode;
    (window as any).electronAPI?.invoke(MIRROR_IPC.SET_MODE, mode);
  }

  setDepth(depth: ReflectionDepth): void {
    this.config.depth = depth;
    (window as any).electronAPI?.invoke(MIRROR_IPC.SET_DEPTH, depth);
  }

  emitAction(ev: Omit<MirrorActionEvent, 'id' | 'timestamp'>): void {
    if (!this._isOpen) return;
    (window as any).electronAPI?.send(MIRROR_IPC.ACTION_EVENT, {
      ...ev, id: `act-${++this.actionSeq}`, timestamp: Date.now(),
    });
  }

  wrapThink(agentId: string):      void { this.emitAction({ agentId, kind: 'think',        label: '思考中...' }); }
  wrapPhiSpiral(agentId: string):  void { this.emitAction({ agentId, kind: 'phi-spiral',   label: 'φ螺旋演算' }); }
  wrapZeroExpansion(agentId: string): void { this.emitAction({ agentId, kind: 'zero-expansion', label: 'ゼロ拡張' }); }
  wrapClick(agentId: string, x: number, y: number, label = 'クリック'): void {
    this.emitAction({ agentId, kind: 'click', label, x, y });
  }
  wrapMove(agentId: string, x: number, y: number): void {
    this.emitAction({ agentId, kind: 'move', label: `→ (${Math.round(x)}, ${Math.round(y)})`, x, y });
  }

  sendReflectionImage(dataUrl: string): void {
    if (this._isOpen) (window as any).electronAPI?.send(MIRROR_IPC.REFLECTION_SYNC, dataUrl);
  }

  private _startSync(): void {
    if (this.syncRafId !== null) return;
    let last = 0;
    const loop = (ts: number) => {
      if (!this._isOpen) return;
      if (ts - last >= this.config.syncIntervalMs) {
        const cursors: MirrorCursorState[] = this.layer.renderer.getAll().map(c => ({
          id: c.id, label: c.config.label, color: c.config.color,
          x: c.x, y: c.y, state: c.state, type: c.config.type,
          visible: c.visible, trail: c.trail,
        }));
        (window as any).electronAPI?.send(MIRROR_IPC.CURSOR_BATCH, cursors);
        last = ts;
      }
      this.syncRafId = requestAnimationFrame(loop);
    };
    this.syncRafId = requestAnimationFrame(loop);
  }

  private _stopSync(): void {
    if (this.syncRafId !== null) { cancelAnimationFrame(this.syncRafId); this.syncRafId = null; }
  }
}
