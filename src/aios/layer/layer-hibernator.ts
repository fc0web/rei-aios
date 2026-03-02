/**
 * Rei AIOS — Layer Hibernator
 * Theme J: Layer スリープ/ウェイク制御
 *
 * アクティブ/スリープ方式でメモリを節約する。
 * iOSやWindowsの「アプリの冬眠」と同じ原理。
 *
 * RAM節約効果（設計書 §6.2 より）:
 *   対策なし: 5Layer × 300MB = 1.5GB
 *   本実装:   アクティブ1Layer 300MB + スリープ4Layer × 30MB = 420MB
 *   → 約72%削減
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── 型定義 ────────────────────────────────────────────

export type HibernationLevel =
  | 'awake'      // 完全起動（フルメモリ）
  | 'light'      // 軽スリープ（状態保存・即時復帰可）
  | 'deep'       // 深スリープ（データのみ保持）
  | 'archived';  // アーカイブ（ほぼゼロ・再起動数秒）

export interface HibernationState {
  state: HibernationLevel;
  savedAt?: string;
  estimatedMemoryMB?: number;
}

export interface HibernatedLayerData {
  layerId: number;
  savedAt: string;
  level: HibernationLevel;
  agent: {
    id: string;
    role: string;
    name: string;
    completedTasks: number;
  };
  taskCount: number;
  fileCount: number;
  context?: Record<string, unknown>;
}

// ─── メモリ推定テーブル ────────────────────────────────

const MEMORY_ESTIMATE: Record<HibernationLevel, number> = {
  awake:    300,  // MB
  light:     30,
  deep:       5,
  archived:   1,
};

// ─── LayerHibernator クラス ───────────────────────────

export class LayerHibernator {
  private hibDir: string;
  private log: (msg: string) => void;
  private states = new Map<number, HibernationState>();

  constructor(dataDir: string, log?: (msg: string) => void) {
    this.hibDir = path.join(dataDir, 'hibernation');
    this.log = log || ((msg) => console.log(`[Hibernator] ${msg}`));
    fs.mkdirSync(this.hibDir, { recursive: true });
    this.loadStates();
  }

  // ─── 冬眠（保存）──────────────────────────────────

  async hibernate(
    layerId: number,
    data: Omit<HibernatedLayerData, 'layerId' | 'savedAt' | 'level'>,
    level: HibernationLevel = 'light'
  ): Promise<void> {
    const record: HibernatedLayerData = {
      layerId,
      savedAt: new Date().toISOString(),
      level,
      ...data,
    };

    const filePath = this.getFilePath(layerId);
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2));

    const state: HibernationState = {
      state: level,
      savedAt: record.savedAt,
      estimatedMemoryMB: MEMORY_ESTIMATE[level],
    };
    this.states.set(layerId, state);
    this.saveStates();

    this.log(`Layer ${layerId} hibernated (${level}, ~${MEMORY_ESTIMATE[level]}MB)`);
  }

  // ─── 復元（ウェイク）──────────────────────────────

  async restore(layerId: number): Promise<HibernatedLayerData | null> {
    const filePath = this.getFilePath(layerId);
    if (!fs.existsSync(filePath)) return null;

    try {
      const data: HibernatedLayerData = JSON.parse(
        fs.readFileSync(filePath, 'utf-8')
      );

      this.states.set(layerId, { state: 'awake', estimatedMemoryMB: MEMORY_ESTIMATE.awake });
      this.saveStates();

      this.log(`Layer ${layerId} restored from hibernation (was: ${data.level})`);
      return data;
    } catch (err: any) {
      this.log(`Layer ${layerId} restore failed: ${err.message}`);
      return null;
    }
  }

  // ─── 状態確認 ────────────────────────────────────

  getState(layerId: number): HibernationState {
    return this.states.get(layerId) || { state: 'awake' };
  }

  getAllStates(): Map<number, HibernationState> {
    return new Map(this.states);
  }

  /**
   * 全Layerの推定総メモリ使用量（MB）
   */
  estimateTotalMemoryMB(): number {
    let total = 0;
    for (const state of this.states.values()) {
      total += state.estimatedMemoryMB ?? MEMORY_ESTIMATE.awake;
    }
    return total;
  }

  /**
   * RAM使用量に基づき、スリープを推奨するLayerを返す
   */
  recommendSleep(maxMemoryMB: number): number[] {
    const toSleep: number[] = [];
    let estimated = this.estimateTotalMemoryMB();

    // 使用量が多いLayer（ID大＝優先度低）からスリープ候補に
    const sorted = Array.from(this.states.entries())
      .filter(([id, s]) => id > 1 && s.state === 'awake')
      .sort(([a], [b]) => b - a); // 大きいIDから

    for (const [layerId] of sorted) {
      if (estimated <= maxMemoryMB) break;
      toSleep.push(layerId);
      estimated -= (MEMORY_ESTIMATE.awake - MEMORY_ESTIMATE.light);
    }

    return toSleep;
  }

  /**
   * PCのRAMに基づく推奨Layer数を返す
   */
  static recommendedLayerCount(totalRamMB: number): number {
    if (totalRamMB >= 32768) return 5;  // 32GB以上
    if (totalRamMB >= 16384) return 4;  // 16GB以上
    if (totalRamMB >= 8192)  return 3;  // 8GB以上
    return 2;                            // 8GB未満
  }

  // ─── 内部処理 ────────────────────────────────────

  private getFilePath(layerId: number): string {
    return path.join(this.hibDir, `layer-${layerId}.json`);
  }

  private loadStates(): void {
    const stateFile = path.join(this.hibDir, 'states.json');
    try {
      if (fs.existsSync(stateFile)) {
        const data = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
        for (const [key, val] of Object.entries(data)) {
          this.states.set(parseInt(key), val as HibernationState);
        }
      }
    } catch { /* ignore */ }
  }

  private saveStates(): void {
    const stateFile = path.join(this.hibDir, 'states.json');
    const data: Record<string, HibernationState> = {};
    for (const [id, state] of this.states) {
      data[String(id)] = state;
    }
    try {
      fs.writeFileSync(stateFile, JSON.stringify(data, null, 2));
    } catch { /* ignore */ }
  }
}
