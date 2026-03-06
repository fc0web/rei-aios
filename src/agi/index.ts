// ============================================================
// Rei-AIOS AGI Layer — Phase 1: Entry Point
// src/agi/index.ts
//
// AGIレイヤーの統合エントリーポイント。
// 既存のRei-AIOSに数行で接続できる設計。
//
// 【使い方（既存コードへの追加）】
//
//   import { AGILayer } from './agi';
//
//   const agi = new AGILayer({
//     llmCall: async (system, message) => {
//       // 既存の llm-manager.ts や converter.ts のAPI呼び出しをここに
//       return await yourLLMClient.chat(system, message);
//     },
//     convertToRei: async (jp) => await converter.convert(jp),
//     executeRei: async (script) => await runtime.execute(script),
//   });
//
//   // ユーザーの指示を実行
//   const result = await agi.run("D-FUMTの記事を調べてまとめて");
//
// ============================================================

import { TaskPlanner } from './task-planner';
import { TaskExecutor, TaskExecutorEvents } from './task-executor';
import { createDefaultHandlers, ReiAIOSBridge } from './task-handlers';
import {
  TaskPlan, TaskResult, TaskLogEntry, AGIConfig, DEFAULT_AGI_CONFIG
} from './task-types';
// ★ Phase 2: 自己修復 + Arbitrage Reasoning
import { SelfRepairEngine, RepairResult } from './self-repair';
import { ArbitrageReasoning, ArbitrageResult, ArbitrageConfig, DEFAULT_ARBITRAGE_CONFIG } from './arbitrage-reasoning';
// ★ Phase 3: コンテキスト記憶
import { ContextMemory, ContextMemoryConfig, DEFAULT_MEMORY_CONFIG } from './context-memory';
import { DFUMTEngine, type DFUMTAnalysisReport, type DFUMTEngineConfig, DEFAULT_DFUMT_CONFIG } from './dfumt-engine';

// Re-export for convenience
export { TaskPlanner } from './task-planner';
export { TaskExecutor } from './task-executor';
export { createDefaultHandlers, ReiAIOSBridge } from './task-handlers';
export * from './task-types';
// ★ Phase 2 re-exports
export { SelfRepairEngine } from './self-repair';
export type { RepairResult, ErrorAnalysis, RepairStrategy } from './self-repair';
export { ArbitrageReasoning } from './arbitrage-reasoning';
export type { ArbitrageResult, ArbitrageConfig, ReasoningPath, PathResult } from './arbitrage-reasoning';
// ★ Phase 3 re-exports
export { ContextMemory } from './context-memory';
export type { MemoryEntry, MemorySearchOptions, MemorySearchResult, MemoryStats, ContextMemoryConfig } from './context-memory';
// Phase 7 re-exports
export * from './dfumt-task-types';
export { DFUMTTaskManager } from './dfumt-task-manager';
export * from './persona-task-processor';

/**
 * AGILayer — Phase 1 統合クラス
 *
 * 既存のRei-AIOSに追加するだけで動作する。
 * 既存コードの変更は不要。
 */
export class AGILayer {
  private planner: TaskPlanner;
  private executor: TaskExecutor;
  private config: AGIConfig;
  private history: TaskPlan[] = [];
  // ★ Phase 2
  private selfRepair: SelfRepairEngine;
  private arbitrage: ArbitrageReasoning;
  // ★ Phase 3
  private memory: ContextMemory;
  // ★ Phase 5-D: D-FUMT×AGI統合
  private dfumt: DFUMTEngine;
  private lastDFUMTReport: DFUMTAnalysisReport | null = null;

  constructor(
    bridge: ReiAIOSBridge,
    config?: Partial<AGIConfig>,
    events?: TaskExecutorEvents
  ) {
    this.config = { ...DEFAULT_AGI_CONFIG, ...config, enabled: true };

    // プランナー: LLM呼び出しを注入
    this.planner = new TaskPlanner(bridge.llmCall, this.config);

    // エグゼキューター: イベントコールバック付き
    this.executor = new TaskExecutor(this.config, events);

    // デフォルトハンドラを登録（既存機能と接続）
    const handlers = createDefaultHandlers(bridge);
    handlers.forEach((handler, type) => {
      this.executor.registerHandler(type, handler);
    });

    // ★ Phase 2: 自己修復エンジン
    this.selfRepair = new SelfRepairEngine(bridge.llmCall, this.config.maxRetries);

    // ★ Phase 2: Arbitrage Reasoning エンジン
    this.arbitrage = new ArbitrageReasoning(bridge.llmCall);

    // ★ Phase 2: ExecutorにSelfRepairを接続
    this.executor.setSelfRepair(this.selfRepair);

    // ★ Phase 3: コンテキスト記憶（LLMを注入してサマリー生成を有効化）
    this.memory = new ContextMemory(
      { longTermPath: this.config.logPath.replace('agi-log.json', 'agi-memory.json') },
      bridge.llmCall
    );

    // ★ Phase 5-D: D-FUMT×AGI統合エンジン
    this.dfumt = new DFUMTEngine();
    console.log('[AGI] Phase 5-D D-FUMT×AGI統合エンジン 初期化完了');
  }

  /**
   * ユーザーの自然言語指示を実行
   *
   * 1. 指示をサブタスクに分解（TaskPlanner）
   * 2. 依存関係順に実行（TaskExecutor）
   * 3. 結果を返す
   */
  async run(userQuery: string): Promise<AGIRunResult> {
    if (!this.config.enabled) {
      return {
        success: false,
        error: 'AGIレイヤーが無効です',
        plan: null,
        results: new Map()
      };
    }

    try {
      // ★ Phase 3: 過去記憶をコンテキストとして取得
      const memoryContext = this.memory.getContextForQuery(userQuery);
      if (memoryContext) {
        console.log('[AGI] 📚 関連記憶をコンテキストに注入');
      }

      // ★ Phase 5-D: D-FUMT分析 & 補強
      let dfumtEnrichment = '';
      if (this.dfumt.isEnabled()) {
        const report = this.dfumt.analyzeAndEnrich(userQuery);
        this.lastDFUMTReport = report;
        dfumtEnrichment = report.enrichedPrompt;
      }

      // Step 1: タスク分解（記憶コンテキスト + D-FUMT補強付き）
      const contextParts: string[] = [];
      if (memoryContext) contextParts.push(memoryContext);
      if (dfumtEnrichment) contextParts.push(dfumtEnrichment);
      const enrichedQuery = contextParts.length > 0
        ? (contextParts.join('\n\n') + '\n\n【現在の指示】\n' + userQuery)
        : userQuery;
      const plan = await this.planner.plan(enrichedQuery);
      plan.originalQuery = userQuery;  // 元の指示を保持
      this.history.push(plan);

      console.log(`[AGI] プラン生成: ${plan.subtasks.length}個のサブタスク`);
      plan.subtasks.forEach(t =>
        console.log(`  [${t.id}] ${t.type}: ${t.description} (deps: ${t.dependencies.join(',') || 'なし'})`)
      );

      // Step 2: 実行
      const results = await this.executor.execute(plan);

      // Step 3: 結果の集約
      const allSuccess = plan.subtasks.every(t => t.status === 'done');
      const summary = this.buildSummary(plan, results);

      // ★ Phase 3: 実行結果を記憶に保存（非同期・ノンブロッキング）
      this.memory.recordTaskExecution(plan, results, summary)
        .catch(e => console.warn('[Memory] 記憶保存エラー:', e));

      return {
        success: allSuccess,
        plan,
        results,
        summary,
        memoryContext: memoryContext || undefined,
        error: allSuccess ? undefined : '一部のタスクが失敗しました'
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message || String(error),
        plan: null,
        results: new Map()
      };
    }
  }

  /**
   * タスク計画のみ（実行はしない）
   * プレビュー用途
   */
  async preview(userQuery: string): Promise<TaskPlan> {
    return await this.planner.plan(userQuery);
  }

  /**
   * 実行結果のサマリーを生成
   */
  private buildSummary(plan: TaskPlan, results: Map<string, TaskResult>): string {
    const lines: string[] = [];
    lines.push(`📋 タスク: ${plan.originalQuery}`);
    lines.push(`📊 サブタスク: ${plan.subtasks.length}個`);

    const done = plan.subtasks.filter(t => t.status === 'done').length;
    const failed = plan.subtasks.filter(t => t.status === 'failed').length;
    const skipped = plan.subtasks.filter(t => t.status === 'skipped').length;

    lines.push(`✅ 完了: ${done}  ❌ 失敗: ${failed}  ⏭ スキップ: ${skipped}`);

    if (plan.completedAt && plan.createdAt) {
      const duration = plan.completedAt - plan.createdAt;
      lines.push(`⏱ 所要時間: ${(duration / 1000).toFixed(1)}秒`);
    }

    return lines.join('\n');
  }

  /**
   * 実行履歴の取得
   */
  getHistory(): TaskPlan[] {
    return [...this.history];
  }

  /**
   * ログの取得
   */
  getLogs(): TaskLogEntry[] {
    return this.executor.getLogs();
  }

  /**
   * AGIレイヤーの有効/無効切り替え
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * AGIレイヤーが有効かどうか
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  // ★ Phase 2: Arbitrage Reasoning を使った高品質推論
  /**
   * 複数の推論パスを並列実行し、最良の結果を返す
   */
  async reasonWithArbitrage(query: string, context?: string): Promise<ArbitrageResult> {
    const task = {
      id: `arb_${Date.now()}`,
      type: 'compute' as const,
      description: query,
      dependencies: [],
      status: 'pending' as const,
      retryCount: 0
    };
    return await this.arbitrage.reason(task, context);
  }

  // ★ Phase 2: アクセサ
  getSelfRepair(): SelfRepairEngine { return this.selfRepair; }
  getArbitrage(): ArbitrageReasoning { return this.arbitrage; }
  getRepairStats() { return this.selfRepair.getStats(); }
  getArbitrageStats() { return this.arbitrage.getStats(); }

  // ★ Phase 3: コンテキスト記憶アクセサ
  getMemory(): ContextMemory { return this.memory; }
  getMemoryStats() { return this.memory.getStats(); }
  searchMemory(options: import('./context-memory').MemorySearchOptions) {
    return this.memory.search(options);
  }

  // ★ Phase 5-D: D-FUMT×AGI アクセサ
  getDFUMTEngine(): DFUMTEngine { return this.dfumt; }
  getDFUMTStats() { return this.dfumt.getStats(); }
  getDFUMTLastReport(): DFUMTAnalysisReport | null { return this.lastDFUMTReport; }
  getDFUMTTheories() { return this.dfumt.listTheories(); }
  getDFUMTRecentReports(n?: number) { return this.dfumt.getRecentReports(n); }
  clearMemory(target: 'all' | 'short' | 'long' = 'all') {
    this.memory.clear(target);
  }
}

/** AGILayer.run() の戻り値 */
export interface AGIRunResult {
  success: boolean;
  plan: TaskPlan | null;
  results: Map<string, TaskResult>;
  summary?: string;
  memoryContext?: string;  // ★ Phase 3: 参照された過去記憶
  error?: string;
}

// ============================================================
// initAGILayer — 既存Rei-AIOSへの接続関数
// main-aios-additions.ts から呼び出す
// ============================================================

import { ipcMain, BrowserWindow } from 'electron';
// ★ Phase 5: 変換レイヤー
import { getIntentToReiConverter, resetIntentToReiConverter } from '../aios/intent-to-rei';

let _agiLayer: AGILayer | null = null;

/**
 * AGIレイヤーを初期化し、IPCハンドラを登録する。
 *
 * @param llmCallFn - LLM呼び出し関数（AIOSEngine経由）
 * @param getWindow - メインウィンドウ取得関数（イベント通知用）
 * @param apiKey    - Claude APIキー（変換レイヤー専用・省略時は変換機能なし）
 */
export function initAGILayer(
  llmCallFn: (system: string, message: string) => Promise<string>,
  getWindow?: () => BrowserWindow | null,
  apiKey?: string
): void {
  // ★ Phase 5: 変換レイヤー初期化（Claude固定）
  let convertToReiFn: ((japanese: string) => Promise<string>) | undefined;
  if (apiKey) {
    // シングルトンを初期化（or 既存インスタンスのキーを更新）
    const converter = getIntentToReiConverter({ apiKey });
    convertToReiFn = async (japanese: string) => {
      const result = await converter.convertAndValidate({ userIntent: japanese });
      if (!result.success) {
        throw new Error(result.error || '変換失敗');
      }
      return result.reiCode;
    };
    console.log('[AGI] Phase 5 Intent-to-Rei 変換レイヤー有効 ✅');
  } else {
    console.warn('[AGI] Phase 5 変換レイヤー: APIキー未設定 → convertToRei 無効');
  }

  const bridge: ReiAIOSBridge = {
    llmCall: llmCallFn,
    convertToRei: convertToReiFn,
  };

  _agiLayer = new AGILayer(bridge, { enabled: true }, {
    onTaskStart: (task) => {
      console.log(`[AGI] ▶ ${task.id}: ${task.description}`);
      getWindow?.()?.webContents.send('agi:step-start', task);
    },
    onTaskDone: (task, result) => {
      console.log(`[AGI] ✓ ${task.id}: 完了 (${result.duration}ms)`);
      getWindow?.()?.webContents.send('agi:step-complete', { task, result });
    },
    onTaskFail: (task, error) => {
      console.log(`[AGI] ✗ ${task.id}: ${error}`);
      getWindow?.()?.webContents.send('agi:step-error', { task, error });
    },
    onTaskRepair: (task, strategy) => {
      console.log(`[AGI] 🔧 ${task.id}: 自己修復 → ${strategy}`);
      getWindow?.()?.webContents.send('agi:step-repair', { task, strategy });
    },
    onPlanDone: (plan, results) => {
      console.log(`[AGI] 📋 プラン完了: ${plan.originalQuery}`);
      getWindow?.()?.webContents.send('agi:task-complete', { plan });
    }
  });

  // ── IPC ハンドラ登録 ──
  ipcMain.handle('agi:run', async (_event, query: string) => {
    if (!_agiLayer) return { success: false, error: 'AGI未初期化' };
    const result = await _agiLayer.run(query);
    return {
      success: result.success,
      summary: result.summary,
      error: result.error,
      plan: result.plan,
    };
  });

  ipcMain.handle('agi:preview', async (_event, query: string) => {
    if (!_agiLayer) return null;
    return await _agiLayer.preview(query);
  });

  ipcMain.handle('agi:toggle', async (_event, enabled: boolean) => {
    _agiLayer?.setEnabled(enabled);
    return _agiLayer?.isEnabled();
  });

  ipcMain.handle('agi:logs', async () => {
    return _agiLayer?.getLogs() || [];
  });

  ipcMain.handle('agi:history', async () => {
    return _agiLayer?.getHistory() || [];
  });

  // ★ Phase 2: Arbitrage Reasoning IPC
  ipcMain.handle('agi:arbitrage', async (_event, query: string, context?: string) => {
    if (!_agiLayer) return { success: false, error: 'AGI未初期化' };
    try {
      const result = await _agiLayer.reasonWithArbitrage(query, context);
      return {
        success: true,
        selectedPath: result.selectedPath,
        allPaths: result.allPaths,
        reasoning: result.reasoning,
        totalLatency: result.totalLatency,
        spreadScore: result.spreadScore,
      };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

  // ★ Phase 2: 修復統計
  ipcMain.handle('agi:repair-stats', async () => {
    return _agiLayer?.getRepairStats() || { totalRepairs: 0, successRate: 0, byStrategy: {} };
  });

  // ★ Phase 2: Arbitrage統計
  ipcMain.handle('agi:arbitrage-stats', async () => {
    return _agiLayer?.getArbitrageStats() || { totalExecutions: 0, avgSpread: 0, avgPathCount: 0, avgLatency: 0 };
  });

  // ★ Phase 3: コンテキスト記憶 IPC
  ipcMain.handle('agi:memory-stats', async () => {
    return _agiLayer?.getMemoryStats() || {
      totalEntries: 0, shortTermCount: 0, longTermCount: 0,
      byOutcome: {}, byKind: {}, oldestTimestamp: null, newestTimestamp: null
    };
  });

  ipcMain.handle('agi:memory-search', async (_event, options: any) => {
    return _agiLayer?.searchMemory(options) || [];
  });

  ipcMain.handle('agi:memory-recent', async (_event, n?: number) => {
    return _agiLayer?.getMemory().getRecentEntries(n ?? 10) || [];
  });

  ipcMain.handle('agi:memory-record-preference', async (_event, preference: string, tags?: string[]) => {
    if (!_agiLayer) return null;
    return await _agiLayer.getMemory().recordUserPreference(preference, tags);
  });

  ipcMain.handle('agi:memory-add', async (_event, entry: any) => {
    if (!_agiLayer) return null;
    return await _agiLayer.getMemory().addEntry({
      kind:    entry.kind    ?? 'task_execution',
      query:   entry.query   ?? '',
      summary: entry.summary ?? '',
      tags:    entry.tags    ?? [],
      outcome: entry.outcome ?? 'success',
      details: entry.details ?? {},
    });
  });

  ipcMain.handle('agi:memory-clear', async (_event, target?: 'all' | 'short' | 'long') => {
    _agiLayer?.clearMemory(target ?? 'all');
    return true;
  });

  // ★ Phase 5-C: 個別削除・全件取得・タイムライン・タグ分布
  ipcMain.handle('agi:memory-delete', async (_event, id: string) => {
    return _agiLayer?.getMemory().deleteEntry(id) ?? false;
  });

  ipcMain.handle('agi:memory-all', async () => {
    return _agiLayer?.getMemory().getAllEntries() || [];
  });

  ipcMain.handle('agi:memory-timeline', async () => {
    return _agiLayer?.getMemory().getTimelineData() || [];
  });

  ipcMain.handle('agi:memory-tags', async () => {
    return _agiLayer?.getMemory().getTagDistribution() || [];
  });

  console.log('[AGI] Phase 1 AGIレイヤー初期化完了 ✅');
  console.log('[AGI] Phase 2 自己修復 + Arbitrage Reasoning 有効 ✅');
  console.log('[AGI] Phase 3 コンテキスト記憶 有効 ✅');
  console.log(`[AGI] Phase 5 変換レイヤー: ${convertToReiFn ? '有効 ✅' : '無効（APIキー未設定）⚠'}`);
  console.log('[AGI] Phase 5-D D-FUMT×AGI統合 有効 ✅');

  // ★ Phase 5-D: D-FUMT×AGI IPC
  ipcMain.handle('agi:dfumt-stats', async () => {
    return _agiLayer?.getDFUMTStats() || {
      totalAnalyses: 0, theoryDistribution: {}, weaknessFrequency: {},
      avgAxiomScores: { center: 0, periphery: 0, flow: 0, boundary: 0 }, avgProcessingMs: 0
    };
  });

  ipcMain.handle('agi:dfumt-last-report', async () => {
    return _agiLayer?.getDFUMTLastReport() || null;
  });

  ipcMain.handle('agi:dfumt-recent-reports', async (_event, n?: number) => {
    return _agiLayer?.getDFUMTRecentReports(n) || [];
  });

  ipcMain.handle('agi:dfumt-theories', async () => {
    return _agiLayer?.getDFUMTTheories() || [];
  });

  ipcMain.handle('agi:dfumt-analyze', async (_event, query: string) => {
    return _agiLayer?.getDFUMTEngine().analyzeAndEnrich(query) || null;
  });

  ipcMain.handle('agi:dfumt-toggle', async (_event, enabled: boolean) => {
    _agiLayer?.getDFUMTEngine().setEnabled(enabled);
    return enabled;
  });

  // ★ Phase 5: 実行時にAPIキーを更新できるIPC
  ipcMain.removeHandler('agi:converter-update-key'); // 重複登録防止
  ipcMain.handle('agi:converter-update-key', async (_event, newApiKey: string) => {
    if (!newApiKey) return { success: false, error: 'APIキーが空です' };
    try {
      getIntentToReiConverter({ apiKey: newApiKey });
      return { success: true };
    } catch (e: any) {
      return { success: false, error: (e as Error).message };
    }
  });
}
