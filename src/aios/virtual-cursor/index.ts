/**
 * Rei-AIOS Virtual Cursor Layer — 統合エントリーポイント (index.ts)
 * テーマF: 仮想カーソル描画レイヤー
 *
 * 使用例 (shell.html から):
 *   import { VirtualCursorLayer } from './virtual-cursor';
 *
 *   const layer = new VirtualCursorLayer();
 *   layer.init();
 *
 *   // ReiAgentカーソルを追加
 *   const reiCursor = layer.addReiAgent();
 *   reiCursor.moveTo({ targetX: 500, targetY: 300, durationMs: 800, easing: 'spring' });
 *
 *   // φ螺旋演出
 *   await layer.choreographer.phiSpiral('rei-agent', 960, 540);
 */

export * from './cursor';
export * from './renderer';
export * from './choreographer';

import { CursorRenderer } from './renderer';
import { CursorChoreographer } from './choreographer';
import { VirtualCursor } from './cursor';

// ============================================================
// VirtualCursorLayer — 統合ファサード
// ============================================================

export class VirtualCursorLayer {
  renderer:      CursorRenderer;
  choreographer: CursorChoreographer;

  private _initialized: boolean = false;
  private _stopMirror:  (() => void) | null = null;

  constructor() {
    this.renderer      = new CursorRenderer({ zBase: 99000 });
    this.choreographer = new CursorChoreographer(this.renderer);
  }

  // ----------------------------------------------------------
  // 初期化
  // ----------------------------------------------------------

  /** 標準構成でカーソルレイヤーを初期化 */
  async init(): Promise<void> {
    if (this._initialized) return;
    this._initialized = true;

    // デフォルト3カーソルを追加（画面外に配置してから起動シーンで展開）
    this.addReiAgent(-100, -100);
    this.addDFUMTAgent(-100, -100);
    this.addLLMAgent('llm-claude', 'Claude', -100, -100);

    // 起動シーンを再生
    const cx = window.innerWidth  / 2;
    const cy = window.innerHeight / 2;
    const scene = this.choreographer.buildStartupScene(
      ['rei-agent', 'dfumt-agent', 'llm-claude'], cx, cy,
    );
    await this.choreographer.playScene(scene);
  }

  // ----------------------------------------------------------
  // カーソル追加（プリセット）
  // ----------------------------------------------------------

  addReiAgent(x = 200, y = 200): VirtualCursor {
    return this.renderer.addReiAgent('rei-agent', x, y);
  }

  addDFUMTAgent(x = 300, y = 300): VirtualCursor {
    return this.renderer.addDFUMTAgent('dfumt-agent', x, y);
  }

  addLLMAgent(id: string, label: string, x = 400, y = 400): VirtualCursor {
    return this.renderer.addLLMAgent(id, label, x, y);
  }

  addGhost(id: string, x = 0, y = 0): VirtualCursor {
    return this.renderer.addGhost(id, x, y);
  }

  // ----------------------------------------------------------
  // 高レベル操作
  // ----------------------------------------------------------

  /** AIが「考えている」演出 */
  async think(cursorIds?: string[]): Promise<void> {
    const ids = cursorIds ?? [...this.renderer.getAll().map(c => c.id)];
    const cx = window.innerWidth  / 2;
    const cy = window.innerHeight / 2;
    const scene = this.choreographer.buildThinkingScene(ids, cx, cy);
    await this.choreographer.playScene(scene);
  }

  /** ゼロ拡張演出: D-FUMT種層の視覚化 */
  async zeroExpansion(): Promise<void> {
    const ids = this.renderer.getAll().map(c => c.id);
    const cx  = window.innerWidth  / 2;
    const cy  = window.innerHeight / 2;
    await this.choreographer.zeroExpansion(ids, cx, cy, 250);
  }

  /** φ螺旋演出 */
  async phiSpiral(cursorId = 'rei-agent', turns = 3): Promise<void> {
    const cx = window.innerWidth  / 2;
    const cy = window.innerHeight / 2;
    await this.choreographer.phiSpiral(cursorId, cx, cy, turns);
  }

  /** 合わせ鏡モードを開始 */
  startMirrorMode(sourceId = 'rei-agent', mirrorId = 'dfumt-agent'): void {
    const cx = window.innerWidth  / 2;
    const cy = window.innerHeight / 2;
    this._stopMirror = this.choreographer.startMirror(sourceId, mirrorId, cx, cy);
  }

  /** 合わせ鏡モードを停止 */
  stopMirrorMode(): void {
    this._stopMirror?.();
    this._stopMirror = null;
  }

  /** 多次元写像配置 */
  async multidimMap(): Promise<void> {
    const ids = this.renderer.getAll().map(c => c.id);
    await this.choreographer.multidimMap(ids, window.innerWidth, window.innerHeight);
  }

  /** 全カーソルのスナップショット */
  getSnapshots() {
    return this.renderer.getAll().map(c => c.snapshot());
  }

  /** レイヤーを破棄 */
  destroy(): void {
    this.choreographer.stop();
    this._stopMirror?.();
    this.renderer.destroy();
  }
}

/** デフォルトレイヤーインスタンス（シングルトン） */
export const virtualCursorLayer = new VirtualCursorLayer();
