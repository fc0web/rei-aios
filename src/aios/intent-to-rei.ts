/**
 * Rei AIOS — Intent-to-Rei 変換レイヤー (Phase 5)
 *
 * D-FUMT 中心-周囲パターン:
 *   中心 = ユーザーの意図（自然言語）
 *   周囲 = 画面状態 / Reiコマンド体系 / 実行履歴
 *
 * 設計方針:
 *   - 変換担当は Claude 固定（精度・一貫性を保証）
 *   - タスク実行・回答生成は従来通り 14 プロバイダーから選択可能
 *   - LLMManager に依存せず ClaudeAdapter を直接利用
 */

import { ClaudeAdapter } from './claude-adapter';
import { LLMProviderConfig } from './llm-adapter';
import { REI_COMMAND_REFERENCE } from './agent-prompts';

// ─── 型定義 ────────────────────────────────────────────────────────────────

/** 変換レイヤーへの入力 */
export interface IntentInput {
  /** ユーザーの自然言語指示 */
  userIntent: string;
  /** 現在の画面状態（スクリーンショット説明 or OCRテキスト）*/
  screenContext?: string;
  /** 直前の実行結果（成功/失敗/エラーメッセージ）*/
  previousResult?: string;
  /** 追加コンテキスト（開いているアプリ名など）*/
  appContext?: string;
}

/** 変換レイヤーの出力 */
export interface ReiConversionResult {
  /** 変換成功フラグ */
  success: boolean;
  /** Reiコマンド文字列（複数行可）*/
  reiCode: string;
  /** Claudeの思考プロセス（デバッグ用）*/
  reasoning?: string;
  /** 変換失敗時のエラーメッセージ */
  error?: string;
  /** トークン使用量 */
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

/** 変換レイヤーの設定 */
export interface IntentToReiConfig {
  /** Claude API キー */
  apiKey: string;
  /** 使用モデル（デフォルト: claude-sonnet-4-6）*/
  model?: string;
  /** 最大トークン数（デフォルト: 2048）*/
  maxTokens?: number;
  /** temperature（デフォルト: 0.1 ← 決定論的変換を優先）*/
  temperature?: number;
}

// ─── システムプロンプト ────────────────────────────────────────────────────

const CONVERSION_SYSTEM_PROMPT = `あなたは「Rei AIOS 変換エンジン」です。
ユーザーの自然言語指示を、Reiプログラミング言語のコマンド列に変換する専門家です。

## あなたの役割
- ユーザーの意図を正確に解釈し、最適なReiコマンド列を生成する
- 画面状態や実行コンテキストを考慮して、適切な座標・ウィンドウ名・テキストを判断する
- 失敗した場合は代替手段を検討する

## 出力形式（厳守）
必ず以下の形式で出力すること:

<reasoning>
（意図の解釈と変換方針を1〜3行で説明）
</reasoning>

<rei>
（Reiコマンドを1行ずつ記述。コメントは -- で始める）
</rei>

## 重要なルール
1. <rei>ブロック内にはReiコマンドのみ記述（説明文は -- コメントで）
2. 不明な座標は wait(500ms) で待機後に再確認を促すコメントを付ける
3. テキスト入力には win_type() を優先（クリップボード汚染を避ける）
4. ウィンドウ名が不明な場合は win_activate() の代わりに launch() を使う
5. エラーリカバリーが必要な場合は複数の代替コマンドをコメントで示す

${REI_COMMAND_REFERENCE}

## 変換できない場合
<reasoning>変換できない理由</reasoning>
<rei>-- ERROR: 変換不可</rei>
と出力すること。絶対に架空のコマンドを生成しないこと。`;

// ─── パーサー関数 ──────────────────────────────────────────────────────────

/**
 * Claude のレスポンスから <reasoning> と <rei> ブロックを抽出する
 */
function parseClaudeResponse(response: string): {
  reasoning: string;
  reiCode: string;
  success: boolean;
} {
  const reasoningMatch = response.match(/<reasoning>([\s\S]*?)<\/reasoning>/);
  const reiMatch = response.match(/<rei>([\s\S]*?)<\/rei>/);

  const reasoning = reasoningMatch ? reasoningMatch[1].trim() : '';
  const reiCode = reiMatch ? reiMatch[1].trim() : '';

  // エラー判定: コードが空 or ERROR コメントのみ
  const isError = !reiCode
    || reiCode === '-- ERROR: 変換不可'
    || reiCode.startsWith('-- ERROR:');

  return {
    reasoning,
    reiCode,
    success: !isError,
  };
}

/**
 * ユーザー向けのプロンプトを組み立てる
 */
function buildUserPrompt(input: IntentInput): string {
  const parts: string[] = [];

  parts.push(`## ユーザー指示\n${input.userIntent}`);

  if (input.appContext) {
    parts.push(`## アプリコンテキスト\n${input.appContext}`);
  }

  if (input.screenContext) {
    parts.push(`## 現在の画面状態\n${input.screenContext}`);
  }

  if (input.previousResult) {
    parts.push(`## 直前の実行結果\n${input.previousResult}`);
  }

  parts.push('\n上記の指示をReiコマンドに変換してください。');

  return parts.join('\n\n');
}

// ─── IntentToReiConverter クラス ──────────────────────────────────────────

export class IntentToReiConverter {
  private adapter: ClaudeAdapter;
  private model: string;
  private maxTokens: number;
  private temperature: number;

  constructor(config: IntentToReiConfig) {
    const providerConfig: LLMProviderConfig = {
      id: 'claude-converter',
      name: 'Claude (変換専用)',
      type: 'claude',
      apiKey: config.apiKey,
      defaultModel: config.model || 'claude-sonnet-4-6',
      availableModels: [config.model || 'claude-sonnet-4-6'],
      maxTokens: config.maxTokens || 2048,
    };

    this.adapter = new ClaudeAdapter(providerConfig);
    this.model = config.model || 'claude-sonnet-4-6';
    this.maxTokens = config.maxTokens || 2048;
    this.temperature = config.temperature ?? 0.1; // 決定論的変換を優先
  }

  /**
   * ユーザーの意図を Rei コマンドに変換する（メインAPI）
   */
  async convert(input: IntentInput): Promise<ReiConversionResult> {
    try {
      const userPrompt = buildUserPrompt(input);

      const response = await this.adapter.complete({
        messages: [
          { role: 'user', content: userPrompt },
        ],
        systemPrompt: CONVERSION_SYSTEM_PROMPT,
        model: this.model,
        maxTokens: this.maxTokens,
        temperature: this.temperature,
      });

      const { reasoning, reiCode, success } = parseClaudeResponse(response.content);

      return {
        success,
        reiCode,
        reasoning,
        error: success ? undefined : `変換失敗: ${reasoning || 'Reiコードを生成できませんでした'}`,
        usage: response.usage,
      };
    } catch (err: any) {
      return {
        success: false,
        reiCode: '',
        error: `Claude API エラー: ${err.message}`,
      };
    }
  }

  /**
   * 変換 + 即時実行を想定したワンショット変換（将来のエージェントループ統合用）
   * 現時点では convert() のラッパーとして提供
   */
  async convertAndValidate(input: IntentInput): Promise<ReiConversionResult> {
    const result = await this.convert(input);

    if (!result.success || !result.reiCode) {
      return result;
    }

    // 構文的な簡易バリデーション
    const lines = result.reiCode
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('--'));

    const KNOWN_COMMANDS = [
      'click', 'dblclick', 'rightclick', 'move', 'drag',
      'type', 'key', 'shortcut',
      'win_activate', 'win_type', 'win_click',
      'launch', 'wait',
      'excel_set', 'excel_get', 'excel_save',
      'excel_write', 'excel_open', 'excel_formula', 'excel_chart',
      'excel_format', 'excel_clear', 'excel_select', 'excel_click',
      'excel_find', 'excel_new_sheet', 'excel_switch_sheet',
      'note_login', 'note_publish',
      'gdocs_open', 'gdocs_type', 'gdocs_save',
    ];

    const unknownLines = lines.filter(line => {
      const cmd = line.split('(')[0].trim();
      return !KNOWN_COMMANDS.includes(cmd);
    });

    if (unknownLines.length > 0) {
      return {
        ...result,
        reasoning: result.reasoning
          + `\n[警告] 未知のコマンドが含まれています: ${unknownLines.join(', ')}`,
      };
    }

    return result;
  }

  /**
   * APIキーの有効性を確認する
   */
  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      const status = await this.adapter.test();
      return { ok: status.connected, error: status.error };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * 設定を動的に更新する（APIキーのローテーション等）
   */
  updateConfig(updates: Partial<IntentToReiConfig>): void {
    const providerUpdates: Partial<LLMProviderConfig> = {};
    if (updates.apiKey !== undefined) providerUpdates.apiKey = updates.apiKey;
    if (updates.model) providerUpdates.defaultModel = updates.model;
    if (updates.maxTokens) providerUpdates.maxTokens = updates.maxTokens;
    this.adapter.configure(providerUpdates);

    if (updates.model) this.model = updates.model;
    if (updates.maxTokens) this.maxTokens = updates.maxTokens;
    if (updates.temperature !== undefined) this.temperature = updates.temperature;
  }
}

// ─── シングルトンファクトリ ────────────────────────────────────────────────

let _instance: IntentToReiConverter | null = null;

/**
 * シングルトンインスタンスを取得する
 * AIOSEngine や main.ts から呼び出す際はこちらを使う
 */
export function getIntentToReiConverter(config?: IntentToReiConfig): IntentToReiConverter {
  if (!_instance) {
    if (!config) {
      throw new Error(
        'IntentToReiConverter の初回呼び出し時は config (apiKey 必須) を渡してください'
      );
    }
    _instance = new IntentToReiConverter(config);
  } else if (config) {
    _instance.updateConfig(config);
  }
  return _instance;
}

/**
 * シングルトンをリセット（テスト用）
 */
export function resetIntentToReiConverter(): void {
  _instance = null;
}
