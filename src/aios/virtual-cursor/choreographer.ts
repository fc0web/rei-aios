/**
 * Rei-AIOS Virtual Cursor — コレオグラファー (choreographer.ts)
 * テーマF: 仮想カーソル描画レイヤー
 *
 * AIエージェントの「意図」をカーソル動作に変換する。
 * D-FUMTエンジンと連携し、φ螺旋・ゼロ拡張などの
 * 数理的パターンでカーソルを動かす演出も担う。
 */

import { VirtualCursor, MoveCommand, Point } from './cursor';
import { CursorRenderer } from './renderer';

// ============================================================
// 型定義
// ============================================================

/** コレオグラフィーシーン */
export interface ChoreoScene {
  name:   string;
  steps:  ChoreoStep[];
}

/** 1ステップ */
export interface ChoreoStep {
  cursorId:   string;
  action:     'move' | 'click' | 'show' | 'hide' | 'setState' | 'wait';
  params?:    Record<string, unknown>;
  delayMs?:   number;      // このステップの前に待機
  parallel?:  boolean;     // trueなら次のステップと並列実行
}

// ============================================================
// CursorChoreographer
// ============================================================

export class CursorChoreographer {
  private renderer: CursorRenderer;
  private running:  boolean = false;

  constructor(renderer: CursorRenderer) {
    this.renderer = renderer;
  }

  // ----------------------------------------------------------
  // シーン実行
  // ----------------------------------------------------------

  async playScene(scene: ChoreoScene): Promise<void> {
    this.running = true;
    const steps = scene.steps;
    let i = 0;

    while (i < steps.length && this.running) {
      const step = steps[i];
      const parallelSteps: ChoreoStep[] = [step];

      // parallel フラグが続く間まとめる
      while (i + 1 < steps.length && steps[i + 1].parallel) {
        i++;
        parallelSteps.push(steps[i]);
      }

      if (step.delayMs && step.delayMs > 0) {
        await this._sleep(step.delayMs);
      }

      await Promise.all(parallelSteps.map(s => this._executeStep(s)));
      i++;
    }

    this.running = false;
  }

  stop(): void { this.running = false; }

  private async _executeStep(step: ChoreoStep): Promise<void> {
    const cursor = this.renderer.get(step.cursorId);
    if (!cursor) return;

    switch (step.action) {
      case 'move': {
        const p = step.params ?? {};
        await cursor.moveTo({
          targetX:    (p.x    as number) ?? cursor.x,
          targetY:    (p.y    as number) ?? cursor.y,
          durationMs: (p.duration as number) ?? 600,
          easing:     (p.easing as MoveCommand['easing']) ?? 'ease',
        });
        break;
      }
      case 'click':
        await cursor.click();
        break;
      case 'show':
        cursor.show();
        break;
      case 'hide':
        cursor.hide();
        break;
      case 'setState':
        cursor.setState((step.params?.state as string) as never ?? 'idle');
        break;
      case 'wait':
        await this._sleep((step.params?.ms as number) ?? 500);
        break;
    }
  }

  // ----------------------------------------------------------
  // D-FUMT数理パターン演出
  // ----------------------------------------------------------

  /**
   * φ螺旋パターン: カーソルが黄金比螺旋を描いて移動
   */
  async phiSpiral(
    cursorId: string,
    centerX: number,
    centerY: number,
    turns: number = 3,
    durationPerTurn: number = 1200,
  ): Promise<void> {
    const cursor = this.renderer.get(cursorId);
    if (!cursor) return;

    const PHI = 1.6180339887;
    const steps = turns * 36;  // 1ターン36点

    cursor.setState('thinking');

    for (let i = 0; i < steps && this.running; i++) {
      const angle  = (i / 36) * Math.PI * 2;
      const radius = Math.pow(PHI, i / 18) * 8;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      await cursor.moveTo({
        targetX: x, targetY: y,
        durationMs: durationPerTurn / 36,
        easing: 'linear',
      });
    }

    cursor.setState('idle');
  }

  /**
   * ゼロ拡張パターン: 中心から⊕⊖方向に分裂展開
   * D-FUMT種層のゼロ拡張を視覚化
   */
  async zeroExpansion(
    cursorIds: string[],
    centerX: number,
    centerY: number,
    radius: number = 200,
  ): Promise<void> {
    const n = cursorIds.length;
    const promises = cursorIds.map((id, i) => {
      const cursor = this.renderer.get(id);
      if (!cursor) return Promise.resolve();

      // まず中心に集める
      return cursor.moveTo({ targetX: centerX, targetY: centerY, durationMs: 400, easing: 'ease-in' })
        .then(async () => {
          cursor.setState('thinking');
          await this._sleep(200);

          // ⊕⊖ 双方向に展開（D-FUMT拡張）
          const angle = (i / n) * Math.PI * 2;
          const tx = centerX + Math.cos(angle) * radius;
          const ty = centerY + Math.sin(angle) * radius;

          await cursor.moveTo({ targetX: tx, targetY: ty, durationMs: 600, easing: 'spring' });
          cursor.setState('idle');
        });
    });

    await Promise.all(promises);
  }

  /**
   * 合わせ鏡パターン: カーソルAの動きをBが鏡像で追う
   * テーマG「合わせ鏡UI」の先行実装
   */
  startMirror(
    sourceId: string,
    mirrorId: string,
    originX: number,
    originY: number,
  ): () => void {
    const source = this.renderer.get(sourceId);
    const mirror = this.renderer.get(mirrorId);
    if (!source || !mirror) return () => {};

    let frameId: number;

    const update = () => {
      const sx = source.x;
      const sy = source.y;
      // 中心点を基準に鏡像計算
      const mx = 2 * originX - sx;
      const my = 2 * originY - sy;
      mirror.setPosition(mx, my);
      frameId = requestAnimationFrame(update);
    };

    frameId = requestAnimationFrame(update);

    // 停止関数を返す
    return () => cancelAnimationFrame(frameId);
  }

  /**
   * 多次元写像パターン: n個のカーソルをD-FUMT写像で配置
   */
  async multidimMap(
    cursorIds: string[],
    width: number,
    height: number,
  ): Promise<void> {
    const PHI = 1.6180339887;
    const PI_EXT = Math.PI * 1.0159;  // D-FUMT π拡張
    const n = cursorIds.length;

    const promises = cursorIds.map((id, i) => {
      const cursor = this.renderer.get(id);
      if (!cursor) return Promise.resolve();

      // D-FUMT固有写像: π拡張 × φ螺旋
      const phase = (i * PI_EXT) / n;
      const spiral = Math.pow(PHI, i / n);
      const x = width  / 2 + Math.cos(phase) * (width  / 3) * spiral * 0.3;
      const y = height / 2 + Math.sin(phase) * (height / 3) * spiral * 0.3;

      return cursor.moveTo({
        targetX: Math.max(20, Math.min(width - 20, x)),
        targetY: Math.max(20, Math.min(height - 20, y)),
        durationMs: 800 + i * 100,
        easing: 'spring',
      });
    });

    await Promise.all(promises);
  }

  // ----------------------------------------------------------
  // プリセットシーン
  // ----------------------------------------------------------

  /** 起動シーン: 全カーソルが中心から展開 */
  buildStartupScene(cursorIds: string[], centerX: number, centerY: number): ChoreoScene {
    const steps: ChoreoStep[] = [];

    cursorIds.forEach((id, i) => {
      steps.push({ cursorId: id, action: 'show',     delayMs: i * 80, parallel: true });
      steps.push({ cursorId: id, action: 'setState', params: { state: 'thinking' }, parallel: true });
    });

    steps.push({ cursorId: cursorIds[0], action: 'wait', params: { ms: 400 } });

    cursorIds.forEach((id, i) => {
      const angle = (i / cursorIds.length) * Math.PI * 2;
      steps.push({
        cursorId: id, action: 'move',
        params: {
          x: centerX + Math.cos(angle) * 120,
          y: centerY + Math.sin(angle) * 80,
          duration: 600, easing: 'spring',
        },
        parallel: i < cursorIds.length - 1,
      });
    });

    cursorIds.forEach(id => {
      steps.push({ cursorId: id, action: 'setState', params: { state: 'idle' }, parallel: true });
    });

    return { name: 'startup', steps };
  }

  /** 思考シーン: カーソルが中央に集まって考える */
  buildThinkingScene(cursorIds: string[], centerX: number, centerY: number): ChoreoScene {
    const steps: ChoreoStep[] = [];

    // 全カーソルを中心へ
    cursorIds.forEach((id, i) => {
      steps.push({
        cursorId: id, action: 'move',
        params: { x: centerX + (i - 1) * 30, y: centerY, duration: 500, easing: 'ease' },
        parallel: i < cursorIds.length - 1,
      });
    });

    // thinking状態に
    cursorIds.forEach(id => {
      steps.push({ cursorId: id, action: 'setState', params: { state: 'thinking' }, parallel: true });
    });

    steps.push({ cursorId: cursorIds[0], action: 'wait', params: { ms: 1500 } });

    // idle に戻す
    cursorIds.forEach(id => {
      steps.push({ cursorId: id, action: 'setState', params: { state: 'idle' }, parallel: true });
    });

    return { name: 'thinking', steps };
  }

  // ----------------------------------------------------------
  // ユーティリティ
  // ----------------------------------------------------------

  private _sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }
}
