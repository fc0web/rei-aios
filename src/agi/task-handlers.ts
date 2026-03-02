// ============================================================
// Rei-AIOS AGI Layer — Phase 1: Default Task Handlers
// src/agi/task-handlers.ts
//
// 各タスクタイプのデフォルトハンドラ。
// 既存のRei-AIOS機能（converter, runtime, win-api-backend等）を
// TaskHandler インターフェースでラップする。
// ============================================================

import { SubTask, TaskResult, TaskType } from './task-types';
// ★ Phase 4-2: Google Docs
import { GoogleDocsHandler } from '../aios/google-docs/gdocs-handler';
import { TaskHandler } from './task-executor';

/**
 * ハンドラ生成に必要な既存機能への参照
 *
 * これらは既存の Rei-AIOS から渡される。
 * 具体的な import パスはプロジェクト構造に依存するため、
 * AGILayer（index.ts）で注入する。
 */
export interface ReiAIOSBridge {
  /** 日本語→Reiスクリプト変換（converter.ts の機能） */
  convertToRei?: (japanese: string) => Promise<string>;

  /** Reiスクリプト実行（runtime.ts の機能） */
  executeRei?: (script: string) => Promise<{ success: boolean; output?: string }>;

  /** LLM呼び出し（llm-manager.ts の機能） */
  llmCall: (system: string, message: string) => Promise<string>;

  /** ファイル読み書き */
  readFile?: (path: string) => Promise<string>;
  writeFile?: (path: string, content: string) => Promise<void>;
  // ★ Phase 4-2: Google Docs ハンドラ（省略可）
  googleDocsHandler?: GoogleDocsHandler;
  // ★ Phase 4-3: タスクタイプ対応LLM呼び出し（SmartModelRouterを注入する場合）
  taskAwareLlmCall?: (system: string, message: string, taskType: string) => Promise<string>;
}

/**
 * デフォルトハンドラを生成
 * bridgeを通じて既存のRei-AIOS機能に接続する
 */
export function createDefaultHandlers(bridge: ReiAIOSBridge): Map<TaskType, TaskHandler> {
  const handlers = new Map<TaskType, TaskHandler>();
  // ★ Phase 4-2: Google Docs ハンドラ（bridgeから渡すか内部生成）
  const gdocsHandler = bridge.googleDocsHandler || new GoogleDocsHandler(bridge);

  // ──────────────────────────────
  // automation: PC自動化
  // 日本語→Rei変換→実行
  // ──────────────────────────────
  handlers.set('automation', async (task, depResults) => {
    const start = Date.now();
    try {
      if (!bridge.convertToRei || !bridge.executeRei) {
        // 変換/実行が利用不可の場合、LLMで手順を生成
        const result = await bridge.llmCall(
          'PC操作の手順を日本語で説明してください。',
          task.description
        );
        return { taskId: task.id, success: true, data: result, duration: Date.now() - start };
      }

      // 日本語→Reiスクリプト変換
      const reiScript = await bridge.convertToRei(task.description);
      // スクリプト実行
      const execResult = await bridge.executeRei(reiScript);

      return {
        taskId: task.id,
        success: execResult.success,
        data: { script: reiScript, output: execResult.output },
        duration: Date.now() - start
      };
    } catch (e: any) {
      return { taskId: task.id, success: false, error: e.message, duration: Date.now() - start };
    }
  });

  // ──────────────────────────────
  // search: 検索
  // LLMに検索・情報収集を依頼
  // ──────────────────────────────
  handlers.set('search', async (task, depResults) => {
    const start = Date.now();
    try {
      const result = await bridge.llmCall(
        `あなたは情報検索アシスタントです。以下の検索を行い、結果を整理して返してください。
結果はJSON形式で返してください: { "findings": ["結果1", "結果2", ...] }`,
        task.description
      );
      return { taskId: task.id, success: true, data: result, duration: Date.now() - start };
    } catch (e: any) {
      return { taskId: task.id, success: false, error: e.message, duration: Date.now() - start };
    }
  });

  // ──────────────────────────────
  // summarize: 要約
  // 依存タスクの結果を統合・要約
  // ──────────────────────────────
  handlers.set('summarize', async (task, depResults) => {
    const start = Date.now();
    try {
      // 依存タスクの結果を収集
      const context = Array.from(depResults.entries())
        .filter(([_, r]) => r.success && r.data)
        .map(([id, r]) => `[${id}] ${typeof r.data === 'string' ? r.data : JSON.stringify(r.data)}`)
        .join('\n---\n');

      const prompt = context
        ? `以下の情報を基に${task.description}\n\n${context}`
        : task.description;

      const result = await bridge.llmCall(
        'あなたは情報整理アシスタントです。与えられた情報を分かりやすく要約・整理してください。',
        prompt
      );
      return { taskId: task.id, success: true, data: result, duration: Date.now() - start };
    } catch (e: any) {
      return { taskId: task.id, success: false, error: e.message, duration: Date.now() - start };
    }
  });

  // ──────────────────────────────
  // code_gen: コード生成
  // Rei言語・TypeScript等のコード生成
  // ──────────────────────────────
  handlers.set('code_gen', async (task, depResults) => {
    const start = Date.now();
    try {
      const context = Array.from(depResults.entries())
        .filter(([_, r]) => r.success && r.data)
        .map(([id, r]) => `[${id}] ${typeof r.data === 'string' ? r.data : JSON.stringify(r.data)}`)
        .join('\n');

      const prompt = context
        ? `${task.description}\n\n参考情報:\n${context}`
        : task.description;

      const result = await bridge.llmCall(
        `あなたはRei-AIOSのコード生成エンジンです。
Rei言語またはTypeScriptでコードを生成してください。
コードのみ返してください（説明は不要）。`,
        prompt
      );
      return { taskId: task.id, success: true, data: result, duration: Date.now() - start };
    } catch (e: any) {
      return { taskId: task.id, success: false, error: e.message, duration: Date.now() - start };
    }
  });

  // ──────────────────────────────
  // compute: 計算・データ処理
  // ──────────────────────────────
  handlers.set('compute', async (task, depResults) => {
    const start = Date.now();
    try {
      const context = Array.from(depResults.entries())
        .filter(([_, r]) => r.success && r.data)
        .map(([id, r]) => `[${id}] ${typeof r.data === 'string' ? r.data : JSON.stringify(r.data)}`)
        .join('\n');

      const result = await bridge.llmCall(
        `あなたは計算・データ処理エンジンです。計算結果をJSON形式で返してください。`,
        context ? `${task.description}\n\nデータ:\n${context}` : task.description
      );
      return { taskId: task.id, success: true, data: result, duration: Date.now() - start };
    } catch (e: any) {
      return { taskId: task.id, success: false, error: e.message, duration: Date.now() - start };
    }
  });

  // ──────────────────────────────
  // file_op: ファイル操作
  // ──────────────────────────────
  handlers.set('file_op', async (task, depResults) => {
    const start = Date.now();
    try {
      if (!bridge.readFile || !bridge.writeFile) {
        // ファイルI/O未接続の場合、LLMで手順を案内
        const result = await bridge.llmCall(
          'ファイル操作の手順をReiスクリプトで生成してください。',
          task.description
        );
        return { taskId: task.id, success: true, data: result, duration: Date.now() - start };
      }

      // 依存タスクの結果からファイルパスや内容を取得
      // （Phase 2以降でより高度な判断を実装）
      const result = await bridge.llmCall(
        'ファイル操作の内容を分析してください。',
        task.description
      );
      return { taskId: task.id, success: true, data: result, duration: Date.now() - start };
    } catch (e: any) {
      return { taskId: task.id, success: false, error: e.message, duration: Date.now() - start };
    }
  });

  // ──────────────────────────────
  // excel: Excel操作
  // 既存のExcel COMハンドラを呼び出し
  // ──────────────────────────────
  handlers.set('excel', async (task, depResults) => {
    const start = Date.now();
    try {
      if (bridge.convertToRei && bridge.executeRei) {
        const reiScript = await bridge.convertToRei(task.description);
        const execResult = await bridge.executeRei(reiScript);
        return {
          taskId: task.id,
          success: execResult.success,
          data: { script: reiScript, output: execResult.output },
          duration: Date.now() - start
        };
      }
      // フォールバック
      const result = await bridge.llmCall(
        'Excelの操作手順をReiスクリプトで生成してください。',
        task.description
      );
      return { taskId: task.id, success: true, data: result, duration: Date.now() - start };
    } catch (e: any) {
      return { taskId: task.id, success: false, error: e.message, duration: Date.now() - start };
    }
  });

  // ──────────────────────────────
  // vision: 画面認識
  // ──────────────────────────────
  handlers.set('vision', async (task, depResults) => {
    const start = Date.now();
    try {
      if (bridge.convertToRei && bridge.executeRei) {
        const reiScript = await bridge.convertToRei(task.description);
        const execResult = await bridge.executeRei(reiScript);
        return {
          taskId: task.id,
          success: execResult.success,
          data: { script: reiScript, output: execResult.output },
          duration: Date.now() - start
        };
      }
      const result = await bridge.llmCall(
        '画面認識タスクの手順を説明してください。',
        task.description
      );
      return { taskId: task.id, success: true, data: result, duration: Date.now() - start };
    } catch (e: any) {
      return { taskId: task.id, success: false, error: e.message, duration: Date.now() - start };
    }
  });

  // ──────────────────────────────
  // browser: ブラウザ操作
  // ★ Phase 4-2: Google Docs キーワード検出で専用ハンドラへ
  // ──────────────────────────────
  handlers.set('browser', async (task, depResults) => {
    const start = Date.now();
    const desc = task.description.toLowerCase();

    // Google Docs / Sheets / Slides キーワード検出
    const isGDocs = desc.includes('google docs') || desc.includes('グーグルドキュメント') ||
                    desc.includes('docs.google') || desc.includes('google ドキュメント') ||
                    desc.includes('docs.new');
    const isGSheets = desc.includes('google sheet') || desc.includes('スプレッドシート') ||
                      desc.includes('sheets.new');
    const isGSlides = desc.includes('google slide') || desc.includes('スライド') ||
                      desc.includes('slides.new');

    if (isGDocs || isGSheets || isGSlides) {
      // ★ Phase 4-2: Google Workspace 専用ハンドラで実行
      return gdocsHandler.handle(task, depResults);
    }

    // 通常のブラウザ操作: 既存の Rei スクリプト変換
    try {
      if (bridge.convertToRei && bridge.executeRei) {
        const reiScript = await bridge.convertToRei(task.description);
        const execResult = await bridge.executeRei(reiScript);
        return {
          taskId: task.id,
          success: execResult.success,
          data: { script: reiScript, output: execResult.output },
          duration: Date.now() - start
        };
      }
      const result = await bridge.llmCall(
        'ブラウザ操作の手順を説明してください。',
        task.description
      );
      return { taskId: task.id, success: true, data: result, duration: Date.now() - start };
    } catch (e: any) {
      return { taskId: task.id, success: false, error: e.message, duration: Date.now() - start };
    }
  });

  return handlers;
}
