/**
 * Rei AIOS — WSL2 Manager
 * Theme J: 合わせ鏡マルチレイヤー環境
 *
 * WSL2（Ubuntu 22.04）上に仮想Xデスクトップを展開し、
 * 各Layerが独立したデスクトップ環境を持つ基盤を提供する。
 *
 * D-FUMT 中心-周囲パターン:
 *   中心 = Windows主環境（Layer 1）
 *   周囲 = WSL2仮想デスクトップ群（Layer 2〜5）
 *
 * 依存関係（初回セットアップ時にWSL2内で自動インストール）:
 *   - Xvfb（仮想フレームバッファ）
 *   - x11vnc（VNCサーバー）
 *   - openbox（軽量ウィンドウマネージャー）
 */

import { EventEmitter } from 'events';
import { execFile, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';

const execFileAsync = promisify(execFile);

// ─── 型定義 ────────────────────────────────────────────

export type WSL2Status =
  | 'not-installed'    // WSL2 自体が存在しない
  | 'no-distro'        // Ubuntu 22.04 が未インストール
  | 'stopped'          // 停止中
  | 'running'          // 正常稼働
  | 'error';           // エラー状態

export interface VirtualDesktop {
  /** Layer番号（2〜5）*/
  layerId: number;
  /** Xディスプレイ番号（:1 〜 :4）*/
  display: string;
  /** VNCポート（5901〜5904）*/
  vncPort: number;
  /** 稼働中か */
  running: boolean;
  /** プロセスPID */
  xvfbPid?: number;
  vncPid?: number;
  wmPid?: number;
  /** 起動時刻 */
  startedAt?: Date;
}

export interface WSL2ManagerConfig {
  /** WSLディストリビューション名 */
  distro: string;
  /** 最大Layer数（2〜5）*/
  maxLayers: number;
  /** デスクトップ解像度 */
  resolution: string;
  /** カラー深度 */
  colorDepth: number;
  /** ログ関数 */
  log?: (msg: string) => void;
  /** データ保存先 */
  dataDir: string;
}

const DEFAULT_CONFIG: WSL2ManagerConfig = {
  distro: 'Ubuntu-22.04',
  maxLayers: 5,
  resolution: '1280x800',
  colorDepth: 24,
  dataDir: './data',
};

// ─── WSL2Manager クラス ──────────────────────────────

export class WSL2Manager extends EventEmitter {
  private config: WSL2ManagerConfig;
  private log: (msg: string) => void;
  private desktops = new Map<number, VirtualDesktop>();
  private processes = new Map<string, ChildProcess>();

  constructor(config: Partial<WSL2ManagerConfig> & { dataDir: string }) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.log = config.log || ((msg) => console.log(`[WSL2Manager] ${msg}`));
  }

  // ─── WSL2 状態確認 ─────────────────────────────────

  async getStatus(): Promise<WSL2Status> {
    // Windows 以外では WSL2 は使えない
    if (process.platform !== 'win32') {
      this.log('Not Windows — WSL2 unavailable');
      return 'not-installed';
    }

    try {
      // wsl.exe が存在するか確認
      await execFileAsync('wsl.exe', ['--status'], { timeout: 10000 });
    } catch {
      return 'not-installed';
    }

    try {
      // 指定ディストリビューションが存在するか
      const { stdout } = await execFileAsync('wsl.exe', ['--list', '--running'], {
        timeout: 10000,
        encoding: 'utf16le', // WSLの出力はUTF-16
      });
      const runningDistros = stdout.replace(/\0/g, '').split('\n').map(s => s.trim());

      if (runningDistros.some(d => d.includes(this.config.distro))) {
        return 'running';
      }

      // 停止中でも存在するか確認
      const { stdout: allOut } = await execFileAsync('wsl.exe', ['--list', '--quiet'], {
        timeout: 10000,
        encoding: 'utf16le',
      });
      const allDistros = allOut.replace(/\0/g, '').split('\n').map(s => s.trim());
      if (allDistros.some(d => d.includes(this.config.distro.replace('-', ' ')))) {
        return 'stopped';
      }

      return 'no-distro';
    } catch (err: any) {
      this.log(`Status check error: ${err.message}`);
      return 'error';
    }
  }

  // ─── 初回セットアップ ──────────────────────────────

  /**
   * WSL2環境に必要なパッケージをインストールする（初回のみ）。
   * Ubuntu 22.04 が前提。
   */
  async setupEnvironment(): Promise<{ success: boolean; log: string[] }> {
    const logs: string[] = [];
    const wslRun = (cmd: string) => this.runInWSL(cmd, logs);

    this.log('Setting up WSL2 environment...');
    this.emit('setup-start');

    try {
      // パッケージリストの更新
      await wslRun('sudo apt-get update -y 2>&1 | tail -5');

      // 必要パッケージのインストール
      await wslRun(
        'sudo apt-get install -y xvfb x11vnc openbox xdotool ' +
        'wmctrl x11-utils dbus-x11 2>&1 | tail -10'
      );

      // セットアップ完了マーカー
      const markerDir = path.join(this.config.dataDir, 'wsl2');
      fs.mkdirSync(markerDir, { recursive: true });
      fs.writeFileSync(
        path.join(markerDir, 'setup-complete.json'),
        JSON.stringify({ date: new Date().toISOString(), distro: this.config.distro })
      );

      this.log('WSL2 environment setup complete ✅');
      this.emit('setup-complete');
      return { success: true, log: logs };
    } catch (err: any) {
      this.log(`Setup error: ${err.message}`);
      this.emit('setup-error', err.message);
      return { success: false, log: logs };
    }
  }

  isSetupComplete(): boolean {
    const markerPath = path.join(this.config.dataDir, 'wsl2', 'setup-complete.json');
    return fs.existsSync(markerPath);
  }

  // ─── 仮想デスクトップ 起動 ────────────────────────

  /**
   * Layer N 用の仮想デスクトップを起動する。
   * layerId: 2〜5（Layer 1 は Windows メイン環境）
   */
  async startDesktop(layerId: number): Promise<VirtualDesktop> {
    if (layerId < 2 || layerId > 5) {
      throw new Error(`Invalid layerId: ${layerId} (must be 2-5)`);
    }

    if (this.desktops.get(layerId)?.running) {
      this.log(`Layer ${layerId} desktop already running`);
      return this.desktops.get(layerId)!;
    }

    const display = `:${layerId - 1}`; // Layer2→:1, Layer3→:2, ...
    const vncPort = 5900 + layerId - 1;
    const { resolution, colorDepth } = this.config;

    this.log(`Starting Layer ${layerId} desktop (DISPLAY=${display}, VNC :${vncPort})`);
    this.emit('desktop-starting', { layerId, display });

    const desktop: VirtualDesktop = {
      layerId, display, vncPort,
      running: false,
      startedAt: new Date(),
    };
    this.desktops.set(layerId, desktop);

    try {
      // Xvfb 起動（仮想フレームバッファ）
      const xvfbProc = this.spawnWSL(
        `Xvfb ${display} -screen 0 ${resolution}x${colorDepth} -ac &` +
        ` echo $! > /tmp/xvfb-layer${layerId}.pid`
      );
      this.processes.set(`xvfb-${layerId}`, xvfbProc);
      await this.sleep(1500); // Xvfb 起動待機

      // Openbox ウィンドウマネージャー起動
      const wmProc = this.spawnWSL(
        `DISPLAY=${display} openbox --sm-disable &` +
        ` echo $! > /tmp/wm-layer${layerId}.pid`
      );
      this.processes.set(`wm-${layerId}`, wmProc);
      await this.sleep(800);

      // x11vnc 起動（VNC経由でWindowsから見られるようにする）
      const vncProc = this.spawnWSL(
        `DISPLAY=${display} x11vnc -display ${display} ` +
        `-rfbport ${vncPort} -nopw -quiet -forever -shared &` +
        ` echo $! > /tmp/vnc-layer${layerId}.pid`
      );
      this.processes.set(`vnc-${layerId}`, vncProc);
      await this.sleep(1000);

      // 起動確認（VNCポートへの接続テスト）
      const vncReady = await this.waitForPort('127.0.0.1', vncPort, 10000);

      desktop.running = vncReady;
      this.desktops.set(layerId, desktop);

      if (vncReady) {
        this.log(`Layer ${layerId} desktop ready ✅ (VNC: localhost:${vncPort})`);
        this.emit('desktop-ready', desktop);
      } else {
        this.log(`Layer ${layerId} desktop VNC not responding ⚠️`);
        this.emit('desktop-warning', { layerId, message: 'VNC not responding' });
        desktop.running = true; // Xvfbは起動しているとみなす
      }

      return desktop;
    } catch (err: any) {
      desktop.running = false;
      this.log(`Layer ${layerId} desktop start failed: ${err.message}`);
      this.emit('desktop-error', { layerId, error: err.message });
      throw err;
    }
  }

  // ─── 仮想デスクトップ 停止 ────────────────────────

  async stopDesktop(layerId: number): Promise<void> {
    const desktop = this.desktops.get(layerId);
    if (!desktop?.running) return;

    this.log(`Stopping Layer ${layerId} desktop...`);

    // プロセスを停止
    for (const key of [`vnc-${layerId}`, `wm-${layerId}`, `xvfb-${layerId}`]) {
      const proc = this.processes.get(key);
      if (proc && !proc.killed) {
        try { proc.kill('SIGTERM'); } catch { /* ignore */ }
        this.processes.delete(key);
      }
    }

    // PIDファイルからも停止
    await this.runInWSL(
      `for f in /tmp/xvfb-layer${layerId}.pid /tmp/wm-layer${layerId}.pid /tmp/vnc-layer${layerId}.pid; do` +
      `  [ -f "$f" ] && kill $(cat "$f") 2>/dev/null; rm -f "$f"; done`
    ).catch(() => {});

    desktop.running = false;
    this.desktops.set(layerId, desktop);
    this.emit('desktop-stopped', { layerId });
    this.log(`Layer ${layerId} desktop stopped`);
  }

  async stopAll(): Promise<void> {
    for (const layerId of this.desktops.keys()) {
      await this.stopDesktop(layerId).catch(() => {});
    }
  }

  // ─── デスクトップ情報取得 ──────────────────────────

  getDesktop(layerId: number): VirtualDesktop | undefined {
    return this.desktops.get(layerId);
  }

  getAllDesktops(): VirtualDesktop[] {
    return Array.from(this.desktops.values());
  }

  // ─── WSL2 でコマンド実行 ──────────────────────────

  async runInWSL(cmd: string, logBuf?: string[]): Promise<string> {
    const { stdout, stderr } = await execFileAsync(
      'wsl.exe',
      ['-d', this.config.distro, '--', 'bash', '-c', cmd],
      { timeout: 30000, encoding: 'utf8' }
    );
    const output = (stdout + stderr).trim();
    if (logBuf) logBuf.push(output);
    return output;
  }

  private spawnWSL(cmd: string): ChildProcess {
    return spawn('wsl.exe', ['-d', this.config.distro, '--', 'bash', '-c', cmd], {
      detached: false,
      stdio: 'ignore',
    });
  }

  // ─── ユーティリティ ────────────────────────────────

  private async waitForPort(host: string, port: number, timeoutMs: number): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const ok = await new Promise<boolean>(resolve => {
        const sock = new net.Socket();
        sock.setTimeout(1000);
        sock.connect(port, host, () => { sock.destroy(); resolve(true); });
        sock.on('error', () => { sock.destroy(); resolve(false); });
        sock.on('timeout', () => { sock.destroy(); resolve(false); });
      });
      if (ok) return true;
      await this.sleep(500);
    }
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }

  destroy(): void {
    this.stopAll().catch(() => {});
    this.removeAllListeners();
  }
}
