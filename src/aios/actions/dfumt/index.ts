/**
 * D-FUMT AIOS Actions — 統合エントリーポイント
 * Rei-AIOS AIアシスタントへのD-FUMTエンジン統合
 *
 * 使用例 (Rei-AIOS AIアシスタント側):
 *
 *   import { dfumtHandler, toOpenAITools, toAnthropicTools } from './actions/dfumt';
 *
 *   // 1. LLMにツールを登録
 *   const tools = toAnthropicTools();   // または toOpenAITools()
 *
 *   // 2. LLMからのtool_useを処理
 *   const result = await dfumtHandler.handle({
 *     name: 'dfumt_engine_run',
 *     arguments: { input_vector: [0, 1, 1.618, 3.14159] }
 *   });
 *
 *   console.log(result.summary);
 */

export * from './actions';
export * from './handler';

import { DFUMTActionHandler, ActionCall, ActionResult } from './handler';
import { toAnthropicTools, toOpenAITools, DFUMT_ACTIONS } from './actions';

// ============================================================
// Rei-AIOS ブリッジ
// ============================================================

/**
 * Rei-AIOS AIアシスタント向けブリッジクラス
 * LLMプロバイダーの違いを吸収し、統一インターフェースを提供する
 */
export class DFUMTAIOSBridge {
  private handler: DFUMTActionHandler;

  constructor(verbose = false) {
    this.handler = new DFUMTActionHandler({ verbose });
  }

  // ----------------------------------------------------------
  // LLM別ツール定義の取得
  // ----------------------------------------------------------

  /** Anthropic Claude向けtool定義 */
  getAnthropicTools() {
    return toAnthropicTools();
  }

  /** OpenAI GPT向けtool定義 */
  getOpenAITools() {
    return toOpenAITools();
  }

  // ----------------------------------------------------------
  // ツール呼び出し処理
  // ----------------------------------------------------------

  /**
   * Anthropic tool_useブロックを処理
   * LLMレスポンスの content[].type === 'tool_use' を渡す
   */
  async handleAnthropicToolUse(toolUse: {
    id: string;
    name: string;
    input: Record<string, unknown>;
  }): Promise<{ tool_use_id: string; result: ActionResult }> {
    const result = await this.handler.handle({
      name: toolUse.name,
      arguments: toolUse.input,
    });
    return { tool_use_id: toolUse.id, result };
  }

  /**
   * OpenAI function_callを処理
   * LLMレスポンスの tool_calls[] を渡す
   */
  async handleOpenAIFunctionCall(toolCall: {
    id: string;
    function: { name: string; arguments: string };
  }): Promise<{ tool_call_id: string; result: ActionResult }> {
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(toolCall.function.arguments);
    } catch {
      args = {};
    }
    const result = await this.handler.handle({
      name: toolCall.function.name,
      arguments: args,
    });
    return { tool_call_id: toolCall.id, result };
  }

  /**
   * 汎用: アクション名と引数で直接呼び出し
   */
  async call(name: string, args: Record<string, unknown> = {}): Promise<ActionResult> {
    return this.handler.handle({ name, arguments: args });
  }

  /**
   * バッチ実行: 複数アクションを順次処理
   */
  async callBatch(calls: ActionCall[]): Promise<ActionResult[]> {
    return this.handler.handleBatch(calls);
  }

  // ----------------------------------------------------------
  // システムプロンプト生成
  // ----------------------------------------------------------

  /**
   * AIアシスタント向けシステムプロンプト（D-FUMT説明付き）を生成
   */
  buildSystemPrompt(): string {
    const actionList = DFUMT_ACTIONS.map(a =>
      `- ${a.name} [${a.category}]: ${a.description.slice(0, 80)}`,
    ).join('\n');

    return `
あなたはRei-AIOSのAIアシスタントです。D-FUMT（Dimensional Fujimoto Universal Mathematical Theory）エンジンへのアクセス権を持っています。

## D-FUMTエンジンについて
D-FUMTは種(Seed)→代謝(Metabolism)→選択(Selection)の3層構造を持つ数理計算エンジンです。
- **種(Seed)**: ゼロ拡張縮小・多次元写像
- **代謝(Metabolism)**: 公式変換・合成・簡約
- **選択(Selection)**: 整合性評価・淘汰・多世代進化

## 利用可能なアクション (${DFUMT_ACTIONS.length}種)
${actionList}

## 使用方針
1. 数値分析・数学的探索の依頼には積極的にD-FUMTアクションを活用してください
2. まず \`dfumt_verify\` で整合性を確認し、次に \`dfumt_engine_run\` でフル分析を実行するのが推奨フローです
3. 結果のsummaryフィールドを中心にユーザーへ説明してください
`.trim();
  }

  /** 利用可能アクション一覧 */
  listActions() {
    return this.handler.listActions();
  }
}

// ============================================================
// デフォルトエクスポート
// ============================================================

/** デフォルトブリッジインスタンス */
export const dfumtBridge = new DFUMTAIOSBridge();

/**
 * クイックスタート: アクション名と引数で即座に実行
 * @example
 *   const result = await callDFUMT('dfumt_engine_run', { input_vector: [0, 1, 1.618] });
 */
export async function callDFUMT(
  name: string,
  args: Record<string, unknown> = {},
): Promise<ActionResult> {
  return dfumtBridge.call(name, args);
}
