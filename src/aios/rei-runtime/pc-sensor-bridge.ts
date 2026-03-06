/**
 * PCSensorBridge — Windows PC センサー → RuntimeBus 接続
 *
 * Node.js 標準モジュールのみ使用（os, fs, path）。
 * 外部センサーライブラリ不要。容量ゼロ追加。
 *
 * 取得できるデータ:
 *   os.loadavg()       → CPU負荷
 *   os.freemem()       → メモリ残量
 *   os.uptime()        → 稼働時間
 *   fs.watch()         → ファイル変更
 *   process.cpuUsage() → CPU時間
 */

import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { ReiAIOSRuntimeBus } from '../rei-aios-runtime-bus';
import { ReiPLAIOSConnector } from './rei-pl-aios-connector';
import { type SevenLogicValue } from '../../axiom-os/seven-logic';

export interface PCSensorConfig {
  watchDirs: string[];       // 監視するディレクトリ
  intervalMs: number;        // センサー読み取り間隔 (default: 30000 = 30秒)
  autoRunRei: boolean;       // .rei ファイル変更時に自動実行
  log?: (msg: string) => void;
}

export const DEFAULT_PC_CONFIG: PCSensorConfig = {
  watchDirs: [],
  intervalMs: 30_000,
  autoRunRei: false,         // デフォルトOFF（安全のため）
  log: console.log,
};

export class PCSensorBridge {
  private config: PCSensorConfig;
  private bus: ReiAIOSRuntimeBus;
  private connector: ReiPLAIOSConnector;
  private watchers: fs.FSWatcher[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private prevCpuUsage = process.cpuUsage();

  constructor(bus: ReiAIOSRuntimeBus, config: Partial<PCSensorConfig> = {}) {
    this.bus = bus;
    this.config = { ...DEFAULT_PC_CONFIG, ...config };
    this.connector = new ReiPLAIOSConnector(bus);
  }

  /** センサー読み取りを開始 */
  start(): void {
    // 定期センサー読み取り
    this.intervalId = setInterval(() => {
      this.readAndPublish();
    }, this.config.intervalMs);

    // 初回即時実行
    this.readAndPublish();

    // ファイルシステム監視
    for (const dir of this.config.watchDirs) {
      this.watchDir(dir);
    }

    this.config.log?.(`[PCSensorBridge] 起動 interval=${this.config.intervalMs}ms dirs=${this.config.watchDirs.length}件`);
  }

  /** センサー読み取りを停止 */
  stop(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
    for (const w of this.watchers) w.close();
    this.watchers = [];
    this.config.log?.('[PCSensorBridge] 停止');
  }

  /** PC状態を読み取って RuntimeBus に発火 */
  readAndPublish(): void {
    const totalMem  = os.totalmem();
    const freeMem   = os.freemem();
    const usedMemRatio = (totalMem - freeMem) / totalMem;  // 0〜1

    // CPU使用率（前回との差分）
    const currentCpu = process.cpuUsage(this.prevCpuUsage);
    this.prevCpuUsage = process.cpuUsage();
    const cpuRatio = (currentCpu.user + currentCpu.system) /
                     (this.config.intervalMs * 1000);  // マイクロ秒→比率
    const cpuPercent = Math.min(100, cpuRatio * 100);

    const cpuTag: SevenLogicValue =
      cpuPercent > 90 ? 'INFINITY' :
      cpuPercent > 70 ? 'FLOWING'  :
      cpuPercent > 0  ? 'TRUE'     : 'ZERO';

    const memTag: SevenLogicValue =
      usedMemRatio > 0.95 ? 'INFINITY' :
      usedMemRatio > 0.80 ? 'FLOWING'  :
                            'TRUE';

    const overallTag: SevenLogicValue =
      cpuTag === 'INFINITY' || memTag === 'INFINITY' ? 'INFINITY' :
      cpuTag === 'FLOWING'  || memTag === 'FLOWING'  ? 'FLOWING'  :
                                                       'TRUE';

    const phi = 1 - (usedMemRatio * 0.5 + Math.min(cpuPercent / 100, 1) * 0.5);

    this.bus.publish({
      type: 'space_snapshot',
      source: 'pc-sensor',
      timestamp: Date.now(),
      payload: {
        spaceName: 'pc_state',
        overallTag,
        phi,
        dimensions: [
          { name: 'cpu_percent',    value: Math.round(cpuPercent),              logicTag: cpuTag },
          { name: 'mem_used_ratio', value: Math.round(usedMemRatio * 100),     logicTag: memTag },
          { name: 'free_mem_gb',    value: Math.round(freeMem / 1e9 * 10) / 10, logicTag: memTag },
          { name: 'uptime_hours',   value: Math.round(os.uptime() / 3600),     logicTag: 'TRUE' as SevenLogicValue },
        ],
      },
    });
  }

  /** ディレクトリを監視し .rei ファイル変更を検出 */
  private watchDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      this.config.log?.(`[PCSensorBridge] 警告: ${dir} が存在しません`);
      return;
    }

    const watcher = fs.watch(dir, { recursive: true }, async (event, filename) => {
      if (!filename) return;
      const fullPath = path.join(dir, filename);

      // ファイル変更を space_snapshot として通知
      this.bus.publish({
        type: 'space_snapshot',
        source: `fs-watch:${dir}`,
        timestamp: Date.now(),
        payload: {
          spaceName: 'filesystem',
          overallTag: 'FLOWING' as SevenLogicValue,
          phi: 0.5,
          dimensions: [
            { name: 'changed_file', value: null, logicTag: 'FLOWING' as SevenLogicValue },
          ],
        },
      });

      this.config.log?.(`[PCSensorBridge] ファイル変更: ${filename} (${event})`);

      // .rei ファイルの変更 → 自動実行（autoRunRei=true の時のみ）
      if (this.config.autoRunRei && filename.endsWith('.rei')) {
        try {
          const source = fs.readFileSync(fullPath, 'utf-8');
          const result = await this.connector.execute(source, `fs:${filename}`);
          this.config.log?.(`[PCSensorBridge] Rei実行: ${filename} → ${result.logicValue}`);
        } catch (e: any) {
          this.config.log?.(`[PCSensorBridge] Rei実行エラー: ${e.message}`);
        }
      }
    });

    this.watchers.push(watcher);
    this.config.log?.(`[PCSensorBridge] 監視開始: ${dir}`);
  }
}
