/**
 * Rei AIOS — Screen Observer
 * Phase A: ヘッドレス対応スクリーンキャプチャ
 *
 * Electron の desktopCapturer に依存せず、PowerShell / CLI で画面を取得する。
 * D-FUMT 中心-周囲パターン:
 *   中心 = 画面の現在状態
 *   周囲 = UIツリー / OCR テキスト / ウィンドウ一覧
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ─── 型定義 ──────────────────────────────────────────

export interface ScreenObservation {
  /** Base64 PNG スクリーンショット */
  screenshot?: string;
  /** スクリーンショット幅 */
  width?: number;
  /** スクリーンショット高さ */
  height?: number;
  /** アクティブウィンドウのタイトル */
  activeWindow: string;
  /** 実行中ウィンドウ一覧 */
  windowList: WindowInfo[];
  /** UIAutomation ツリー（将来 Phase B で拡張） */
  uiTree?: string;
  /** 画面から抽出したテキスト（OCR / UIAutomation） */
  screenText?: string;
  /** タイムスタンプ */
  timestamp: number;
  /** エラー情報 */
  errors: string[];
}

export interface WindowInfo {
  title: string;
  processName: string;
  pid: number;
  isActive: boolean;
}

export interface ScreenObserverConfig {
  /** スクリーンショット取得を有効化 */
  captureEnabled: boolean;
  /** 一時ファイル保存ディレクトリ */
  tempDir?: string;
  /** スクリーンショットの最大幅（リサイズ） */
  maxWidth?: number;
  /** タイムアウト（ms） */
  timeoutMs?: number;
}

const DEFAULT_CONFIG: ScreenObserverConfig = {
  captureEnabled: true,
  maxWidth: 1280,
  timeoutMs: 10000,
};

// ─── PowerShell スクリプト断片 ─────────────────────────

const PS_GET_ACTIVE_WINDOW = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class Win32 {
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
"@
$hwnd = [Win32]::GetForegroundWindow()
$sb = New-Object System.Text.StringBuilder 256
[Win32]::GetWindowText($hwnd, $sb, 256) | Out-Null
$procId = [uint32]0
[Win32]::GetWindowThreadProcessId($hwnd, [ref]$procId) | Out-Null
$proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
Write-Output "$($sb.ToString())|$($proc.ProcessName)|$procId"
`;

const PS_GET_WINDOW_LIST = `
Get-Process | Where-Object { $_.MainWindowTitle -ne '' } |
  Select-Object @{N='title';E={$_.MainWindowTitle}},
                @{N='name';E={$_.ProcessName}},
                @{N='pid';E={$_.Id}} |
  ConvertTo-Json -Compress
`;

const PS_CAPTURE_SCREEN = (outputPath: string, maxWidth: number) => `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
$gfx = [System.Drawing.Graphics]::FromImage($bmp)
$gfx.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$gfx.Dispose()
$w = ${maxWidth}
if ($bmp.Width -gt $w) {
  $ratio = $w / $bmp.Width
  $h = [int]($bmp.Height * $ratio)
  $resized = New-Object System.Drawing.Bitmap($w, $h)
  $g2 = [System.Drawing.Graphics]::FromImage($resized)
  $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g2.DrawImage($bmp, 0, 0, $w, $h)
  $g2.Dispose()
  $bmp.Dispose()
  $bmp = $resized
}
$bmp.Save("${outputPath.replace(/\\/g, '\\\\')}", [System.Drawing.Imaging.ImageFormat]::Png)
$w2 = $bmp.Width
$h2 = $bmp.Height
$bmp.Dispose()
Write-Output "$w2|$h2"
`;

// ─── ScreenObserver クラス ────────────────────────────

export class ScreenObserver {
  private config: ScreenObserverConfig;
  private tempDir: string;
  private isWindows: boolean;

  constructor(config?: Partial<ScreenObserverConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.isWindows = os.platform() === 'win32';
    this.tempDir = this.config.tempDir || path.join(os.tmpdir(), 'rei-aios-obs');
    this.ensureDir(this.tempDir);
  }

  /**
   * 画面の現在状態を観察（Observe フェーズ）
   */
  async observe(): Promise<ScreenObservation> {
    const errors: string[] = [];
    const timestamp = Date.now();

    // アクティブウィンドウ取得
    let activeWindow = '(unknown)';
    if (this.isWindows) {
      try {
        activeWindow = this.getActiveWindow();
      } catch (e: any) {
        errors.push(`ActiveWindow: ${e.message}`);
      }
    }

    // ウィンドウ一覧取得
    let windowList: WindowInfo[] = [];
    if (this.isWindows) {
      try {
        windowList = this.getWindowList();
      } catch (e: any) {
        errors.push(`WindowList: ${e.message}`);
      }
    }

    // スクリーンショット取得
    let screenshot: string | undefined;
    let width: number | undefined;
    let height: number | undefined;
    if (this.config.captureEnabled && this.isWindows) {
      try {
        const cap = this.captureScreen();
        screenshot = cap.base64;
        width = cap.width;
        height = cap.height;
      } catch (e: any) {
        errors.push(`Screenshot: ${e.message}`);
      }
    }

    return {
      screenshot,
      width,
      height,
      activeWindow,
      windowList,
      timestamp,
      errors,
    };
  }

  /**
   * 観察結果を自然言語テキストに変換（プロンプト用）
   */
  describeObservation(obs: ScreenObservation): string {
    const lines: string[] = [];
    lines.push(`[Screen Observation @ ${new Date(obs.timestamp).toISOString()}]`);
    lines.push(`Active Window: ${obs.activeWindow}`);

    if (obs.windowList.length > 0) {
      lines.push(`\nOpen Windows (${obs.windowList.length}):`);
      for (const w of obs.windowList.slice(0, 15)) {
        const mark = w.isActive ? '→ ' : '  ';
        lines.push(`${mark}[${w.processName}] ${w.title}`);
      }
    }

    if (obs.screenText) {
      lines.push(`\nVisible Text on Screen:\n${obs.screenText}`);
    }

    if (obs.screenshot) {
      lines.push(`\n[Screenshot available: ${obs.width}x${obs.height}]`);
    }

    if (obs.errors.length > 0) {
      lines.push(`\nObservation Warnings: ${obs.errors.join('; ')}`);
    }

    return lines.join('\n');
  }

  /**
   * スクリーンショットがあれば Claude Messages API 用 content block を返す
   */
  buildVisionContent(obs: ScreenObservation, userText: string): any[] {
    const content: any[] = [];
    if (obs.screenshot) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/png',
          data: obs.screenshot,
        },
      });
    }
    content.push({ type: 'text', text: userText });
    return content;
  }

  // ─── Private helpers ─────────────────────────────────

  private getActiveWindow(): string {
    const raw = this.runPowerShell(PS_GET_ACTIVE_WINDOW).trim();
    const parts = raw.split('|');
    return parts[0] || '(unknown)';
  }

  private getWindowList(): WindowInfo[] {
    const raw = this.runPowerShell(PS_GET_WINDOW_LIST).trim();
    if (!raw || raw === '') return [];
    try {
      const parsed = JSON.parse(raw);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const activeTitle = this.getActiveWindow();
      return arr.map((w: any) => ({
        title: w.title || '',
        processName: w.name || '',
        pid: w.pid || 0,
        isActive: w.title === activeTitle,
      }));
    } catch {
      return [];
    }
  }

  private captureScreen(): { base64: string; width: number; height: number } {
    const tmpFile = path.join(this.tempDir, `cap_${Date.now()}.png`);
    try {
      const raw = this.runPowerShell(
        PS_CAPTURE_SCREEN(tmpFile, this.config.maxWidth || 1280)
      ).trim();

      if (!fs.existsSync(tmpFile)) {
        throw new Error('Screenshot file was not created');
      }

      const buf = fs.readFileSync(tmpFile);
      const base64 = buf.toString('base64');

      // パース幅・高さ（PowerShell出力 or PNGヘッダから取得）
      let width = this.config.maxWidth || 1280;
      let height = 720;
      const parts = raw.split('|');
      if (parts.length >= 2) {
        width = parseInt(parts[0], 10) || width;
        height = parseInt(parts[1], 10) || height;
      }

      return { base64, width, height };
    } finally {
      try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    }
  }

  private runPowerShell(script: string): string {
    const timeout = this.config.timeoutMs || 10000;
    // PowerShell の複数行スクリプトを一時 .ps1 ファイル経由で実行
    // （インライン -Command ではヒア文字列や改行が壊れるため）
    const tmpScript = path.join(this.tempDir, `ps_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.ps1`);
    try {
      fs.writeFileSync(tmpScript, script, 'utf-8');
      return execSync(
        `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${tmpScript}"`,
        { encoding: 'utf-8', timeout, windowsHide: true }
      );
    } finally {
      try { fs.unlinkSync(tmpScript); } catch { /* ignore */ }
    }
  }

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
