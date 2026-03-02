/**
 * Rei-AIOS Virtual Cursor — 型定義・基底クラス (cursor.ts)
 * テーマF: 仮想カーソル描画レイヤー
 *
 * Windowsの物理カーソルは1つだけだが、
 * Rei-AIOSは複数の仮想カーソルを画面上に描画し
 * 「複数のAIが同時に動いている」体験を実現する。
 */

// ============================================================
// 型定義
// ============================================================

/** カーソルの種類 */
export type CursorType =
  | 'default'     // 通常矢印
  | 'pointer'     // 手型
  | 'crosshair'   // 十字
  | 'agent'       // AIエージェント専用
  | 'rei'         // Rei内蔵エージェント
  | 'dfumt'       // D-FUMTエンジン
  | 'ghost';      // 半透明ゴーストカーソル

/** カーソル状態 */
export type CursorState =
  | 'idle'        // 待機
  | 'moving'      // 移動中
  | 'clicking'    // クリック中
  | 'dragging'    // ドラッグ中
  | 'thinking';   // AI処理中（脈動アニメーション）

/** 2D座標 */
export interface Point { x: number; y: number; }

/** カーソル設定 */
export interface CursorConfig {
  id:          string;
  label:       string;          // 表示ラベル（エージェント名など）
  type:        CursorType;
  color:       string;          // メインカラー (CSS color)
  size:        number;          // カーソルサイズ (px)
  opacity:     number;          // 不透明度 [0,1]
  showTrail:   boolean;         // 軌跡表示
  trailLength: number;          // 軌跡の長さ（点数）
  showLabel:   boolean;         // ラベル表示
  zIndex:      number;          // 重なり順
}

/** カーソルの瞬間状態 */
export interface CursorSnapshot {
  id:        string;
  position:  Point;
  state:     CursorState;
  timestamp: number;
}

/** アニメーション移動命令 */
export interface MoveCommand {
  targetX:    number;
  targetY:    number;
  durationMs: number;
  easing:     'linear' | 'ease' | 'ease-in' | 'ease-out' | 'spring';
}

// ============================================================
// VirtualCursor — 仮想カーソル基底クラス
// ============================================================

export class VirtualCursor {
  readonly id:     string;
  readonly config: CursorConfig;

  private _x:       number = 0;
  private _y:       number = 0;
  private _state:   CursorState = 'idle';
  private _trail:   Point[] = [];
  private _visible: boolean = true;
  private _animFrame: number | null = null;

  // DOM要素（レンダラー側で設定）
  element:      HTMLElement | null = null;
  labelElement: HTMLElement | null = null;
  trailElements: HTMLElement[] = [];

  constructor(config: CursorConfig) {
    this.config = config;
    this.id     = config.id;
  }

  // ----------------------------------------------------------
  // 状態アクセサ
  // ----------------------------------------------------------

  get x(): number { return this._x; }
  get y(): number { return this._y; }
  get position(): Point { return { x: this._x, y: this._y }; }
  get state(): CursorState { return this._state; }
  get visible(): boolean { return this._visible; }
  get trail(): Point[] { return [...this._trail]; }

  // ----------------------------------------------------------
  // 位置制御
  // ----------------------------------------------------------

  /** 即座に位置を設定 */
  setPosition(x: number, y: number): void {
    if (this.config.showTrail) {
      this._trail.push({ x: this._x, y: this._y });
      if (this._trail.length > this.config.trailLength) {
        this._trail.shift();
      }
    }
    this._x = x;
    this._y = y;
    this._syncDOM();
  }

  /** アニメーション付き移動 */
  async moveTo(cmd: MoveCommand): Promise<void> {
    this._state = 'moving';
    const startX = this._x;
    const startY = this._y;
    const startTime = performance.now();

    return new Promise(resolve => {
      const animate = (now: number) => {
        const elapsed = now - startTime;
        const t = Math.min(elapsed / cmd.durationMs, 1);
        const eased = this._ease(t, cmd.easing);

        this.setPosition(
          startX + (cmd.targetX - startX) * eased,
          startY + (cmd.targetY - startY) * eased,
        );

        if (t < 1) {
          this._animFrame = requestAnimationFrame(animate);
        } else {
          this._state = 'idle';
          this._animFrame = null;
          resolve();
        }
      };
      this._animFrame = requestAnimationFrame(animate);
    });
  }

  /** クリックアニメーション */
  async click(): Promise<void> {
    this._state = 'clicking';
    if (this.element) {
      this.element.style.transform = 'scale(0.8)';
      await this._sleep(80);
      this.element.style.transform = 'scale(1)';
    }
    await this._sleep(120);
    this._state = 'idle';
  }

  // ----------------------------------------------------------
  // 表示制御
  // ----------------------------------------------------------

  show(): void { this._visible = true;  this._syncVisibility(); }
  hide(): void { this._visible = false; this._syncVisibility(); }

  setState(s: CursorState): void {
    this._state = s;
    this._syncStateClass();
  }

  // ----------------------------------------------------------
  // DOM同期
  // ----------------------------------------------------------

  private _syncDOM(): void {
    if (!this.element) return;
    this.element.style.left = `${this._x}px`;
    this.element.style.top  = `${this._y}px`;

    if (this.labelElement && this.config.showLabel) {
      this.labelElement.style.left = `${this._x + 18}px`;
      this.labelElement.style.top  = `${this._y - 6}px`;
    }

    // 軌跡DOM更新
    this.trailElements.forEach((el, i) => {
      const trailPoint = this._trail[this._trail.length - 1 - i];
      if (trailPoint) {
        el.style.left    = `${trailPoint.x}px`;
        el.style.top     = `${trailPoint.y}px`;
        el.style.opacity = String(((i + 1) / this.config.trailLength) * this.config.opacity * 0.5);
      } else {
        el.style.opacity = '0';
      }
    });
  }

  private _syncVisibility(): void {
    if (!this.element) return;
    this.element.style.display = this._visible ? 'block' : 'none';
    if (this.labelElement) {
      this.labelElement.style.display = this._visible ? 'block' : 'none';
    }
  }

  private _syncStateClass(): void {
    if (!this.element) return;
    this.element.dataset.state = this._state;
  }

  // ----------------------------------------------------------
  // イージング関数
  // ----------------------------------------------------------

  private _ease(t: number, type: MoveCommand['easing']): number {
    switch (type) {
      case 'linear':   return t;
      case 'ease':     return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      case 'ease-in':  return t * t * t;
      case 'ease-out': return 1 - Math.pow(1 - t, 3);
      case 'spring': {
        const c4 = (2 * Math.PI) / 3;
        if (t === 0 || t === 1) return t;
        return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
      }
      default: return t;
    }
  }

  private _sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }

  /** スナップショット取得 */
  snapshot(): CursorSnapshot {
    return { id: this.id, position: this.position, state: this._state, timestamp: Date.now() };
  }

  /** クリーンアップ */
  destroy(): void {
    if (this._animFrame !== null) {
      cancelAnimationFrame(this._animFrame);
    }
  }
}
