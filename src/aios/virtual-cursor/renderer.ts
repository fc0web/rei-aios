/**
 * Rei-AIOS Virtual Cursor — 描画エンジン (renderer.ts)
 * テーマF: 仮想カーソル描画レイヤー
 *
 * 全画面オーバーレイに複数の仮想カーソルを描画する。
 * 物理カーソルとは独立して動作し、AIエージェントの
 * 「存在」を視覚的に表現する。
 */

import { VirtualCursor, CursorConfig, CursorType, Point } from './cursor';

// ============================================================
// 型定義
// ============================================================

export interface RendererConfig {
  containerId?: string;    // オーバーレイを挿入するDOM要素のID (省略時=body)
  zBase?:       number;    // z-indexのベース値
  enablePhysicalHide?: boolean;  // 物理カーソルを非表示にするか
}

// ============================================================
// CursorRenderer — カーソル描画エンジン
// ============================================================

export class CursorRenderer {
  private overlay:  HTMLElement;
  private cursors:  Map<string, VirtualCursor> = new Map();
  private config:   Required<RendererConfig>;
  private styleEl:  HTMLStyleElement;

  constructor(config: RendererConfig = {}) {
    this.config = {
      containerId:         config.containerId ?? '',
      zBase:               config.zBase       ?? 99000,
      enablePhysicalHide:  config.enablePhysicalHide ?? false,
    };

    // オーバーレイ作成
    this.overlay = document.createElement('div');
    this.overlay.id = 'rei-cursor-overlay';
    this.overlay.style.cssText = [
      'position:fixed', 'inset:0', 'pointer-events:none',
      `z-index:${this.config.zBase}`, 'overflow:hidden',
    ].join(';');

    // スタイル注入
    this.styleEl = document.createElement('style');
    this.styleEl.textContent = this._buildCSS();
    document.head.appendChild(this.styleEl);

    const container = this.config.containerId
      ? (document.getElementById(this.config.containerId) ?? document.body)
      : document.body;
    container.appendChild(this.overlay);

    if (this.config.enablePhysicalHide) {
      document.body.style.cursor = 'none';
    }
  }

  // ----------------------------------------------------------
  // カーソル管理
  // ----------------------------------------------------------

  /** 仮想カーソルを追加 */
  add(config: CursorConfig): VirtualCursor {
    if (this.cursors.has(config.id)) {
      return this.cursors.get(config.id)!;
    }

    const cursor = new VirtualCursor(config);

    // メインDOM要素
    const el = document.createElement('div');
    el.className   = `rei-cursor rei-cursor--${config.type}`;
    el.id          = `rei-cursor-${config.id}`;
    el.dataset.state = 'idle';
    el.style.cssText = [
      'position:absolute',
      `width:${config.size}px`,
      `height:${config.size}px`,
      `opacity:${config.opacity}`,
      `z-index:${this.config.zBase + config.zIndex}`,
      'pointer-events:none',
      'will-change:transform,left,top',
    ].join(';');

    // カーソル形状をSVGで描画
    el.innerHTML = this._buildCursorSVG(config.type, config.color, config.size);

    // ラベル
    let labelEl: HTMLElement | null = null;
    if (config.showLabel) {
      labelEl = document.createElement('div');
      labelEl.className = 'rei-cursor-label';
      labelEl.textContent = config.label;
      labelEl.style.cssText = [
        'position:absolute',
        'font-size:11px',
        'font-family:JetBrains Mono,monospace',
        'white-space:nowrap',
        'pointer-events:none',
        `color:${config.color}`,
        'background:rgba(6,6,11,0.85)',
        'padding:2px 7px',
        'border-radius:4px',
        `border:1px solid ${config.color}40`,
        `z-index:${this.config.zBase + config.zIndex + 1}`,
      ].join(';');
      this.overlay.appendChild(labelEl);
    }

    // 軌跡要素
    const trailEls: HTMLElement[] = [];
    if (config.showTrail) {
      for (let i = 0; i < config.trailLength; i++) {
        const t = document.createElement('div');
        t.className = 'rei-cursor-trail';
        const tSize = Math.max(3, config.size * 0.3 * (1 - i / config.trailLength));
        t.style.cssText = [
          'position:absolute',
          `width:${tSize}px`, `height:${tSize}px`,
          'border-radius:50%',
          `background:${config.color}`,
          'pointer-events:none',
          'transform:translate(-50%,-50%)',
          `z-index:${this.config.zBase + config.zIndex - 1}`,
        ].join(';');
        this.overlay.appendChild(t);
        trailEls.push(t);
      }
    }

    cursor.element       = el;
    cursor.labelElement  = labelEl;
    cursor.trailElements = trailEls;

    this.overlay.appendChild(el);
    this.cursors.set(config.id, cursor);

    return cursor;
  }

  /** 仮想カーソルを削除 */
  remove(id: string): void {
    const cursor = this.cursors.get(id);
    if (!cursor) return;

    cursor.element?.remove();
    cursor.labelElement?.remove();
    cursor.trailElements.forEach(t => t.remove());
    cursor.destroy();
    this.cursors.delete(id);
  }

  /** カーソルを取得 */
  get(id: string): VirtualCursor | undefined { return this.cursors.get(id); }

  /** 全カーソルを取得 */
  getAll(): VirtualCursor[] { return [...this.cursors.values()]; }

  /** 全カーソルを削除 */
  clear(): void {
    [...this.cursors.keys()].forEach(id => this.remove(id));
  }

  // ----------------------------------------------------------
  // プリセットカーソル生成
  // ----------------------------------------------------------

  /** ReiAgentカーソル（青） */
  addReiAgent(id = 'rei-agent', x = 100, y = 100): VirtualCursor {
    const c = this.add({
      id, label: 'Rei Agent',
      type: 'rei', color: '#6e9ecf',
      size: 24, opacity: 0.9,
      showTrail: true, trailLength: 8,
      showLabel: true, zIndex: 10,
    });
    c.setPosition(x, y);
    return c;
  }

  /** D-FUMTカーソル（紫） */
  addDFUMTAgent(id = 'dfumt-agent', x = 200, y = 200): VirtualCursor {
    const c = this.add({
      id, label: 'D-FUMT',
      type: 'dfumt', color: '#9b7ecf',
      size: 20, opacity: 0.85,
      showTrail: true, trailLength: 12,
      showLabel: true, zIndex: 9,
    });
    c.setPosition(x, y);
    return c;
  }

  /** LLMエージェントカーソル（金） */
  addLLMAgent(id: string, label: string, x = 300, y = 300): VirtualCursor {
    const c = this.add({
      id, label,
      type: 'agent', color: '#c4a85a',
      size: 22, opacity: 0.85,
      showTrail: true, trailLength: 6,
      showLabel: true, zIndex: 8,
    });
    c.setPosition(x, y);
    return c;
  }

  /** ゴーストカーソル（半透明・過去操作の残像） */
  addGhost(id: string, x = 0, y = 0): VirtualCursor {
    const c = this.add({
      id, label: '',
      type: 'ghost', color: '#a8a8c0',
      size: 18, opacity: 0.3,
      showTrail: false, trailLength: 0,
      showLabel: false, zIndex: 5,
    });
    c.setPosition(x, y);
    return c;
  }

  // ----------------------------------------------------------
  // SVGカーソル形状
  // ----------------------------------------------------------

  private _buildCursorSVG(type: CursorType, color: string, size: number): string {
    const s = size;

    switch (type) {
      case 'rei':
        // 六角形 + 中心ドット（零の象徴）
        return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polygon points="12,2 20,7 20,17 12,22 4,17 4,7"
            stroke="${color}" stroke-width="1.5" fill="${color}18"/>
          <circle cx="12" cy="12" r="3" fill="${color}"
            style="filter:drop-shadow(0 0 4px ${color})"/>
          <circle cx="12" cy="12" r="5" stroke="${color}" stroke-width="0.5" fill="none" opacity="0.5"/>
        </svg>`;

      case 'dfumt':
        // 二重円 + 十字（D-FUMT ⊕⊖の象徴）
        return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="9" stroke="${color}" stroke-width="1.2" fill="${color}12"/>
          <circle cx="12" cy="12" r="4" stroke="${color}" stroke-width="1" fill="${color}25"/>
          <line x1="12" y1="3" x2="12" y2="21" stroke="${color}" stroke-width="0.8" opacity="0.6"/>
          <line x1="3" y1="12" x2="21" y2="12" stroke="${color}" stroke-width="0.8" opacity="0.6"/>
          <circle cx="12" cy="12" r="1.5" fill="${color}"
            style="filter:drop-shadow(0 0 3px ${color})"/>
        </svg>`;

      case 'agent':
        // ダイヤモンド形（汎用AIエージェント）
        return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polygon points="12,2 22,12 12,22 2,12"
            stroke="${color}" stroke-width="1.5" fill="${color}18"/>
          <polygon points="12,6 18,12 12,18 6,12"
            stroke="${color}" stroke-width="0.8" fill="${color}25" opacity="0.7"/>
          <circle cx="12" cy="12" r="2" fill="${color}"
            style="filter:drop-shadow(0 0 3px ${color})"/>
        </svg>`;

      case 'crosshair':
        return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="7" stroke="${color}" stroke-width="1"/>
          <line x1="12" y1="1" x2="12" y2="8" stroke="${color}" stroke-width="1.5"/>
          <line x1="12" y1="16" x2="12" y2="23" stroke="${color}" stroke-width="1.5"/>
          <line x1="1" y1="12" x2="8" y2="12" stroke="${color}" stroke-width="1.5"/>
          <line x1="16" y1="12" x2="23" y2="12" stroke="${color}" stroke-width="1.5"/>
          <circle cx="12" cy="12" r="1.5" fill="${color}"/>
        </svg>`;

      case 'ghost':
        return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 3C8 3 5 6 5 10v9l2-2 2 2 2-2 2 2 2-2 2 2v-9c0-4-3-7-7-7z"
            stroke="${color}" stroke-width="1" fill="${color}18"/>
          <circle cx="9" cy="10" r="1.5" fill="${color}" opacity="0.6"/>
          <circle cx="15" cy="10" r="1.5" fill="${color}" opacity="0.6"/>
        </svg>`;

      default: // 'default', 'pointer'
        return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 2L4 18L8 14L11 20L13 19L10 13L15 13Z"
            fill="${color}" stroke="${color}80" stroke-width="0.5"
            style="filter:drop-shadow(0 0 4px ${color}80)"/>
        </svg>`;
    }
  }

  // ----------------------------------------------------------
  // CSS
  // ----------------------------------------------------------

  private _buildCSS(): string {
    return `
/* Rei-AIOS Virtual Cursor Styles */
.rei-cursor {
  position: absolute;
  pointer-events: none;
  transform-origin: center;
  transition: transform 80ms ease;
  will-change: left, top;
}
.rei-cursor[data-state="thinking"] {
  animation: rei-cursor-think 1.2s ease-in-out infinite;
}
.rei-cursor[data-state="clicking"] {
  animation: rei-cursor-click 150ms ease-out;
}
.rei-cursor[data-state="moving"] svg {
  filter: brightness(1.3);
}
@keyframes rei-cursor-think {
  0%,100% { transform: scale(1); filter: brightness(1); }
  50%     { transform: scale(1.25); filter: brightness(1.5) drop-shadow(0 0 8px currentColor); }
}
@keyframes rei-cursor-click {
  0%   { transform: scale(1); }
  40%  { transform: scale(0.75); }
  100% { transform: scale(1); }
}
.rei-cursor--rei[data-state="idle"] svg polygon {
  animation: rei-hex-rotate 8s linear infinite;
  transform-origin: 12px 12px;
}
@keyframes rei-hex-rotate {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
.rei-cursor--dfumt[data-state="idle"] svg circle:first-child {
  animation: dfumt-pulse 2s ease-in-out infinite;
}
@keyframes dfumt-pulse {
  0%,100% { opacity: 0.6; }
  50%     { opacity: 1; }
}
.rei-cursor-label {
  position: absolute;
  pointer-events: none;
  transition: left 60ms linear, top 60ms linear;
  letter-spacing: 0.06em;
}
.rei-cursor-trail {
  position: absolute;
  pointer-events: none;
  transition: left 80ms linear, top 80ms linear, opacity 200ms;
}
    `.trim();
  }

  /** オーバーレイを破棄 */
  destroy(): void {
    this.clear();
    this.overlay.remove();
    this.styleEl.remove();
    if (this.config.enablePhysicalHide) {
      document.body.style.cursor = '';
    }
  }
}
