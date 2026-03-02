/**
 * Rei-AIOS Shell — メインプロセス (shell-main.ts)
 * テーマD: Electronシェル実装
 *
 * 起動すると Rei-AIOS がフルスクリーンで立ち上がり、
 * Rei-Automator・D-FUMTエンジン・AIアシスタントが統合された
 * デスクトップシェルとして動作する。
 */

import { app, BrowserWindow, ipcMain, screen, shell, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
// ── テーマG: 合わせ鏡 UI ──────────────────────────────────
import { MirrorWindowManager }   from '../mirror-ui/mirror-window';
// ── ActionExecutor: mirrorHook 接続用 ───────────────────
import { ActionExecutor }         from '../action-executor';
// ── テーマH: D-FUMTダッシュボード ────────────────────────
import { DashboardWindowManager } from '../dashboard/dashboard-window';
// ── テーマH: Reiインタプリタ統合 ─────────────────────────
import { ReiREPL }                from '../rei-runtime/rei-repl';
// ── テーマI: 数学知識ネットワーク統合 ────────────────────
import { KnowledgeWindowManager } from '../knowledge/knowledge-window';

// ============================================================
// 定数
// ============================================================

const SHELL_VERSION = '0.1.0';
const SHELL_TITLE   = 'Rei-AIOS Shell';
const PRELOAD_PATH  = path.join(__dirname, 'preload-shell.js');
const SHELL_HTML    = path.join(__dirname, '../../src/aios/shell/shell.html');

// ============================================================
// ウィンドウ管理
// ============================================================

let mainWindow: BrowserWindow | null = null;
// ── テーマG: 合わせ鏡マネージャー ────────────────────────
let mirrorManager:    MirrorWindowManager    | null = null;
// ── テーマH: ダッシュボード + Rei REPL ───────────────────
let dashboardManager: DashboardWindowManager | null = null;
let reiREPL:          ReiREPL               | null = null;
// ── テーマI: 数学知識ネットワーク ────────────────────────
let knowledgeManager: KnowledgeWindowManager | null = null;

// ── ActionExecutor: 合わせ鏡フック接続 ──────────────────
const actionExecutor = new ActionExecutor({
  mirrorHook: (kind, command, meta) => {
    mirrorManager?.notifyAction(kind, command, meta);
  },
});

function createShellWindow(): void {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    // フレームレス: Rei-AIOS独自UIがウィンドウ枠を担う
    frame: false,
    titleBarStyle: 'hidden',
    transparent: false,
    backgroundColor: '#0a0a0f',

    // フルスクリーン起動（F11 or 設定で切替可能）
    fullscreen: false,
    fullscreenable: true,
    resizable: true,
    movable: true,

    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },

    icon: path.join(__dirname, '../../assets/rei-icon.png'),
    title: SHELL_TITLE,

    // タスクバーには表示するが、通常のデスクトップアプリとして振る舞う
    skipTaskbar: false,
    alwaysOnTop: false,
  });

  // HTMLを読み込む
  mainWindow.loadFile(SHELL_HTML);

  // 開発時のみDevToolsを開く
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // ウィンドウが閉じられたらnullにする
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 外部リンクはデフォルトブラウザで開く
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // ── テーマG: MirrorWindowManager 初期化 ──────────────
  mirrorManager = new MirrorWindowManager(mainWindow);
  mirrorManager.registerIpcHandlers();

  // ── テーマH: ダッシュボード + Rei REPL 初期化 ─────────
  dashboardManager = new DashboardWindowManager(mainWindow);
  dashboardManager.registerIpcHandlers();

  reiREPL = new ReiREPL(
    mainWindow,
    { dryRun: false, timeoutMs: 15000 },
    (kind, command, meta) => mirrorManager?.notifyAction(kind, command, meta),
  );
  reiREPL.registerIpcHandlers();

  // ── テーマI: 数学知識ネットワーク統合 ─────────────────
  knowledgeManager = new KnowledgeWindowManager(mainWindow);
  knowledgeManager.registerIpcHandlers();
}

// ============================================================
// アプリライフサイクル
// ============================================================

app.whenReady().then(() => {
  // メニューバーを非表示（シェルUIで代替）
  Menu.setApplicationMenu(null);

  createShellWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createShellWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ============================================================
// IPC ハンドラー
// ============================================================

/** シェル情報取得 */
ipcMain.handle('shell:info', () => ({
  version: SHELL_VERSION,
  platform: process.platform,
  arch: process.arch,
  nodeVersion: process.versions.node,
  electronVersion: process.versions.electron,
  pid: process.pid,
}));

/** ウィンドウ操作 */
ipcMain.handle('shell:window', (_event, action: string) => {
  if (!mainWindow) return;
  switch (action) {
    case 'minimize':   mainWindow.minimize(); break;
    case 'maximize':   mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize(); break;
    case 'fullscreen': mainWindow.setFullScreen(!mainWindow.isFullScreen()); break;
    case 'close':      mainWindow.close(); break;
  }
});

/** フルスクリーン状態取得 */
ipcMain.handle('shell:isFullscreen', () => mainWindow?.isFullScreen() ?? false);

/** アプリ再起動 */
ipcMain.handle('shell:restart', () => {
  app.relaunch();
  app.exit(0);
});

/** ログ書き出し */
ipcMain.handle('shell:log', (_event, message: string, level: string = 'info') => {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
  const logPath = path.join(app.getPath('userData'), 'rei-aios-shell.log');
  fs.appendFileSync(logPath, line, 'utf8');
});

/** 設定の読み書き */
const configPath = path.join(app.getPath('userData'), 'shell-config.json');

ipcMain.handle('shell:getConfig', () => {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch { /* ignore */ }
  return {};
});

ipcMain.handle('shell:setConfig', (_event, config: Record<string, unknown>) => {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch {
    return false;
  }
});
