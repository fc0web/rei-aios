// ============================================================
// Rei-AIOS AGI Phase 4-2: Google Docs 自動化
// src/aios/google-docs/gdocs-handler.ts
//
// 【概要】
//   既存の launch() + win_type() + クリップボード方式を
//   Google Docs に特化して使いやすくラップしたハンドラ。
//
// 【できること】
//   - 新規ドキュメント作成
//   - 既存ドキュメントを URL で開く
//   - テキスト追記（クリップボード経由で日本語対応）
//   - 見出し / 箇条書き / 太字 / 斜体 などの書式適用
//   - 選択・コピー・ペースト
//   - ドキュメントタイトル変更
//   - スプレッドシート / スライド にも応用可能
//
// 【仕組み】
//   PowerShell を使って:
//     1. Chrome/Edge で docs.new を開く
//     2. クリップボード経由でテキストを貼り付け
//     3. Ctrl+ショートカットで書式を操作
//   ネイティブ依存なし・Puppeteer 不要
//
// 【統合方法】
//   task-handlers.ts の browser ハンドラを以下で置き換え:
//
//   import { GoogleDocsHandler } from '../aios/google-docs/gdocs-handler';
//   const gdocs = new GoogleDocsHandler(bridge);
//   handlers.set('browser', (task, deps) => gdocs.handle(task, deps));
// ============================================================

import { execFile } from 'child_process';
import { SubTask, TaskResult } from '../../agi/task-types';
import { TaskHandler } from '../../agi/task-executor';
import { ReiAIOSBridge } from '../../agi/task-handlers';

// ──────────────────────────────────────────
// PowerShell ユーティリティ
// ──────────────────────────────────────────

function runPS(script: string, timeoutMs = 15000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', [
      '-NoProfile', '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-Command', script,
    ], { timeout: timeoutMs }, (err, stdout, stderr) => {
      if (err) reject(new Error(`PS error: ${err.message}\n${stderr}`));
      else resolve(stdout.trim());
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ──────────────────────────────────────────
// 操作コマンド型
// ──────────────────────────────────────────

export type GDocsAction =
  | 'open_new'          // 新規ドキュメントを作成して開く
  | 'open_url'          // URLを指定して開く
  | 'type_text'         // テキストを入力（クリップボード経由）
  | 'type_heading'      // 見出しとしてテキストを入力
  | 'type_bullet'       // 箇条書きとして入力
  | 'apply_bold'        // 選択中のテキストを太字に
  | 'apply_italic'      // 斜体に
  | 'apply_heading1'    // 見出し1スタイルに
  | 'apply_heading2'    // 見出し2スタイルに
  | 'apply_normal'      // 標準テキストに戻す
  | 'select_all'        // 全選択
  | 'copy'              // コピー
  | 'paste'             // 貼り付け
  | 'undo'              // 元に戻す
  | 'save'              // 保存（Ctrl+S）
  | 'new_line'          // 改行
  | 'set_title';        // ドキュメントタイトル変更

export interface GDocsCommand {
  action: GDocsAction;
  text?: string;        // type_* アクション用
  url?: string;         // open_url 用
  windowTitle?: string; // ウィンドウ特定用（省略可）
}

// ──────────────────────────────────────────
// Google Docs 操作スクリプト生成
// ──────────────────────────────────────────

/** クリップボードにテキストをセットしてCtrl+Vでペースト */
function clipboardTypeScript(hwndOrTitle: string, text: string): string {
  const escaped = text.replace(/'/g, "''").replace(/"/g, '`"');
  return `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Clipboard]::SetText("${escaped}")
Start-Sleep -Milliseconds 200
$wshell = New-Object -ComObject WScript.Shell
$wshell.AppActivate("${hwndOrTitle}")
Start-Sleep -Milliseconds 300
[System.Windows.Forms.SendKeys]::SendWait("^v")
Start-Sleep -Milliseconds 200
`;
}

/** ショートカットキーを送信 */
function sendShortcutScript(hwndOrTitle: string, keys: string): string {
  return `
$wshell = New-Object -ComObject WScript.Shell
$wshell.AppActivate("${hwndOrTitle}")
Start-Sleep -Milliseconds 200
[System.Windows.Forms.SendKeys]::SendWait("${keys}")
Start-Sleep -Milliseconds 100
`;
}

/** Chrome/Edge で URL を開く */
function openUrlScript(url: string, browser: 'chrome' | 'edge' | 'auto' = 'auto'): string {
  if (browser === 'chrome') {
    return `Start-Process 'chrome.exe' -ArgumentList '${url}'`;
  }
  if (browser === 'edge') {
    return `Start-Process 'msedge.exe' -ArgumentList '${url}'`;
  }
  // auto: chrome優先、なければedge、なければデフォルトブラウザ
  return `
$chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
$edgePath   = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
if (Test-Path $chromePath) {
  Start-Process $chromePath -ArgumentList '${url}'
} elseif (Test-Path $edgePath) {
  Start-Process $edgePath -ArgumentList '${url}'
} else {
  Start-Process '${url}'
}
`;
}

// ──────────────────────────────────────────
// Google Docs ハンドラクラス
// ──────────────────────────────────────────

export class GoogleDocsHandler {
  private bridge: ReiAIOSBridge;
  private defaultWindowTitle = 'Google ドキュメント';

  constructor(bridge: ReiAIOSBridge) {
    this.bridge = bridge;
  }

  /** TaskHandler として AGI に登録できるラッパー */
  getTaskHandler(): TaskHandler {
    return async (task, depResults) => this.handle(task, depResults);
  }

  /**
   * タスク説明を解析してGoogle Docs操作を実行
   */
  async handle(task: SubTask, depResults: Map<string, TaskResult>): Promise<TaskResult> {
    const start = Date.now();
    try {
      // LLMでタスク説明をGDocsコマンドリストに変換
      const commands = await this._parseToCommands(task.description, depResults);
      const log: string[] = [];

      for (const cmd of commands) {
        const result = await this._executeCommand(cmd);
        log.push(`[${cmd.action}] ${result}`);
      }

      return {
        taskId: task.id,
        success: true,
        data: { commands, log },
        duration: Date.now() - start
      };
    } catch (e: any) {
      return {
        taskId: task.id,
        success: false,
        error: e.message,
        duration: Date.now() - start
      };
    }
  }

  /**
   * LLMを使ってタスク説明をGDocsコマンドリストに変換
   */
  private async _parseToCommands(
    description: string,
    depResults: Map<string, TaskResult>
  ): Promise<GDocsCommand[]> {
    // 依存タスクの結果を収集
    const context = Array.from(depResults.entries())
      .filter(([_, r]) => r.success && r.data)
      .map(([id, r]) => `[${id}]: ${typeof r.data === 'string' ? r.data : JSON.stringify(r.data)}`)
      .join('\n');

    const systemPrompt = `あなたはGoogle Docs自動化AIです。
タスク説明をJSON形式のコマンドリストに変換してください。

使用可能なアクション:
- open_new: 新規ドキュメント作成
- open_url: URLを開く (url フィールド必須)
- type_text: テキスト入力 (text フィールド必須)
- type_heading: 見出しとして入力 (text フィールド必須)
- type_bullet: 箇条書きとして入力 (text フィールド必須)
- apply_bold: 太字
- apply_italic: 斜体
- apply_heading1: 見出し1
- apply_heading2: 見出し2
- apply_normal: 標準テキスト
- select_all: 全選択
- new_line: 改行
- save: 保存
- set_title: タイトル変更 (text フィールド必須)

出力はJSONのみ。例:
[
  { "action": "open_new" },
  { "action": "set_title", "text": "レポート" },
  { "action": "type_heading", "text": "概要" },
  { "action": "new_line" },
  { "action": "type_text", "text": "内容..." },
  { "action": "save" }
]`;

    const userPrompt = context
      ? `タスク: ${description}\n\n参考情報:\n${context}`
      : `タスク: ${description}`;

    try {
      const raw = await this.bridge.llmCall(systemPrompt, userPrompt);
      // JSON部分を抽出
      const match = raw.match(/\[[\s\S]*\]/);
      if (!match) throw new Error('LLMがコマンドリストを返しませんでした');
      return JSON.parse(match[0]) as GDocsCommand[];
    } catch (e: any) {
      // フォールバック: シンプルなopen + type
      console.warn('[GDocs] LLMパース失敗、フォールバック:', e.message);
      return [
        { action: 'open_new' },
        { action: 'type_text', text: description }
      ];
    }
  }

  /**
   * 単一コマンドを実行
   */
  async _executeCommand(cmd: GDocsCommand): Promise<string> {
    const winTitle = cmd.windowTitle || this.defaultWindowTitle;

    switch (cmd.action) {

      case 'open_new': {
        await runPS(openUrlScript('https://docs.new'));
        await sleep(3000); // ページロード待ち
        this.defaultWindowTitle = 'Google ドキュメント';
        return 'docs.new を開きました';
      }

      case 'open_url': {
        if (!cmd.url) throw new Error('open_url に url が必要です');
        await runPS(openUrlScript(cmd.url));
        await sleep(3000);
        return `URL を開きました: ${cmd.url}`;
      }

      case 'type_text': {
        if (!cmd.text) return 'text が空です';
        await runPS(clipboardTypeScript(winTitle, cmd.text));
        await sleep(300);
        return `テキスト入力: "${cmd.text.slice(0, 30)}..."`;
      }

      case 'type_heading': {
        if (!cmd.text) return 'text が空です';
        // 見出し1スタイル適用してから入力
        await runPS(sendShortcutScript(winTitle, '^+1'));  // Ctrl+Shift+1
        await sleep(200);
        await runPS(clipboardTypeScript(winTitle, cmd.text));
        await sleep(200);
        await runPS(sendShortcutScript(winTitle, '^+0'));  // Ctrl+Shift+0 で標準に戻す
        return `見出し入力: "${cmd.text}"`;
      }

      case 'type_bullet': {
        if (!cmd.text) return 'text が空です';
        // 箇条書きリスト切り替え (Ctrl+Shift+8)
        await runPS(sendShortcutScript(winTitle, '^+8'));
        await sleep(200);
        await runPS(clipboardTypeScript(winTitle, cmd.text));
        return `箇条書き入力: "${cmd.text}"`;
      }

      case 'apply_bold':
        await runPS(sendShortcutScript(winTitle, '^b'));
        return '太字を適用';

      case 'apply_italic':
        await runPS(sendShortcutScript(winTitle, '^i'));
        return '斜体を適用';

      case 'apply_heading1':
        await runPS(sendShortcutScript(winTitle, '^+1'));
        return '見出し1を適用';

      case 'apply_heading2':
        await runPS(sendShortcutScript(winTitle, '^+2'));
        return '見出し2を適用';

      case 'apply_normal':
        await runPS(sendShortcutScript(winTitle, '^+0'));
        return '標準テキストに戻した';

      case 'select_all':
        await runPS(sendShortcutScript(winTitle, '^a'));
        return '全選択';

      case 'copy':
        await runPS(sendShortcutScript(winTitle, '^c'));
        return 'コピー';

      case 'paste':
        await runPS(sendShortcutScript(winTitle, '^v'));
        return 'ペースト';

      case 'undo':
        await runPS(sendShortcutScript(winTitle, '^z'));
        return '元に戻した';

      case 'save':
        await runPS(sendShortcutScript(winTitle, '^s'));
        await sleep(500);
        return '保存';

      case 'new_line': {
        await runPS(sendShortcutScript(winTitle, '{ENTER}'));
        return '改行';
      }

      case 'set_title': {
        if (!cmd.text) return 'text が空です';
        // Google Docsのタイトルクリック → 全選択 → 入力
        const titleScript = `
Add-Type -AssemblyName System.Windows.Forms
$wshell = New-Object -ComObject WScript.Shell
$wshell.AppActivate("${winTitle}")
Start-Sleep -Milliseconds 300
# Ctrl+Alt+Hでタイトルフィールドへ（Google Docs のアクセシビリティショートカット）
[System.Windows.Forms.SendKeys]::SendWait("^%h")
Start-Sleep -Milliseconds 500
`;
        await runPS(titleScript);
        await sleep(200);
        await runPS(clipboardTypeScript(winTitle, cmd.text));
        return `タイトル設定: "${cmd.text}"`;
      }

      default:
        return `不明なアクション: ${(cmd as any).action}`;
    }
  }
}

// ──────────────────────────────────────────
// Reiスクリプト生成ヘルパー
// Google Docs操作をReiスクリプトとして出力する
// ──────────────────────────────────────────

/**
 * Google Docs操作のReiスクリプトを生成
 * converter.ts のプロンプトに追加することで、
 * 自然言語→Reiの変換でもGoogle Docsを扱えるようになる
 */
export function generateGDocsReiScript(commands: GDocsCommand[]): string {
  const lines: string[] = [
    '// Google Docs 自動化スクリプト (Phase 4-2)',
    '// 生成日時: ' + new Date().toLocaleString('ja-JP'),
    '',
  ];

  for (const cmd of commands) {
    switch (cmd.action) {
      case 'open_new':
        lines.push('launch("https://docs.new")');
        lines.push('wait(3000)');
        break;
      case 'open_url':
        if (cmd.url) {
          lines.push(`launch("${cmd.url}")`);
          lines.push('wait(3000)');
        }
        break;
      case 'type_text':
        if (cmd.text) {
          lines.push(`win_type("Google ドキュメント", "${cmd.text.replace(/"/g, '\\"')}")`);
        }
        break;
      case 'new_line':
        lines.push('key("Enter")');
        break;
      case 'apply_bold':
        lines.push('shortcut("Ctrl+B")');
        break;
      case 'apply_italic':
        lines.push('shortcut("Ctrl+I")');
        break;
      case 'save':
        lines.push('shortcut("Ctrl+S")');
        lines.push('wait(500)');
        break;
      case 'select_all':
        lines.push('shortcut("Ctrl+A")');
        break;
      default:
        lines.push(`// ${cmd.action}: ${cmd.text || ''}`);
    }
    lines.push('wait(200)');
  }

  return lines.join('\n');
}

// ──────────────────────────────────────────
// IPC登録ヘルパー
// main.ts から呼び出す
// ──────────────────────────────────────────

import { ipcMain } from 'electron';

let _gdocsHandler: GoogleDocsHandler | null = null;

export function initGoogleDocsHandler(bridge: ReiAIOSBridge): void {
  _gdocsHandler = new GoogleDocsHandler(bridge);

  // 直接コマンド実行
  ipcMain.handle('gdocs:execute', async (_event, command: GDocsCommand) => {
    if (!_gdocsHandler) return { success: false, error: '未初期化' };
    try {
      const result = await _gdocsHandler._executeCommand(command);
      return { success: true, result };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

  // コマンドリスト一括実行
  ipcMain.handle('gdocs:execute-batch', async (_event, commands: GDocsCommand[]) => {
    if (!_gdocsHandler) return { success: false, error: '未初期化' };
    const log: string[] = [];
    try {
      for (const cmd of commands) {
        const r = await _gdocsHandler._executeCommand(cmd);
        log.push(`[${cmd.action}] ${r}`);
      }
      return { success: true, log };
    } catch (e: any) {
      return { success: false, error: e.message, log };
    }
  });

  // 自然言語から実行（LLM変換→実行）
  ipcMain.handle('gdocs:run-natural', async (_event, description: string) => {
    if (!_gdocsHandler) return { success: false, error: '未初期化' };
    const fakeTask = {
      id: `gdocs_${Date.now()}`,
      type: 'browser' as const,
      description,
      dependencies: [],
      status: 'pending' as const,
      retryCount: 0,
    };
    const result = await _gdocsHandler.handle(fakeTask, new Map());
    return result;
  });

  // Reiスクリプト生成のみ（実行なし）
  ipcMain.handle('gdocs:generate-rei', async (_event, commands: GDocsCommand[]) => {
    return generateGDocsReiScript(commands);
  });

  console.log('[GDocs] Phase 4-2 Google Docs ハンドラ初期化完了 ✅');
}
