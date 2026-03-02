/**
 * Rei AIOS — 豊聡耳パイプライン統合 (Toyosatomi Pipeline)
 *
 * 3つの連携を実現するブリッジモジュール:
 *   1. OCR結果 → 豊聡耳分析 (toyosatomi_analyze)
 *   2. 豊聡耳出力 → Reiスクリプト生成 → 実行 (toyosatomi_execute)
 *   3. Agent Loop ＋ 豊聡耳 (迷い検出 → 複数AI相談)
 *
 * D-FUMT 中心-周囲パターン:
 *   中心 = ユーザーの目的（タスク / 質問）
 *   周囲 = OCR / Vision / 複数AI見解 / スクリプト生成
 */

import ToyosatomiEngine, {
  ToyosatomiAgent,
  ToyosatomiSession,
  ToyosatomiJudgeResult,
  ToyosatomiPanelResult,
} from './toyosatomi';
import { IntentToReiConverter, ReiConversionResult } from './intent-to-rei';
import { ILLMAdapter, LLMProviderConfig } from './llm-adapter';
import { LLMManager } from './llm-manager';

// ─── 型定義 ──────────────────────────────────────────

/** OCR → 豊聡耳分析の結果 */
export interface ToyosatomiAnalysisResult {
  /** 入力テキスト（OCR結果） */
  inputText: string;
  /** 分析プロンプト */
  prompt: string;
  /** 各AIの回答 */
  panels: ToyosatomiPanelResult[];
  /** ジャッジ結果（有効時） */
  judge?: ToyosatomiJudgeResult;
  /** 処理時間(ms) */
  elapsedMs: number;
}

/** 豊聡耳 → スクリプト生成 → 実行の結果 */
export interface ToyosatomiExecutionResult {
  /** 豊聡耳の統合回答 */
  synthesis: string;
  /** 生成されたReiコード */
  reiCode: string;
  /** 変換成功フラグ */
  conversionSuccess: boolean;
  /** 変換のreasoning */
  reasoning?: string;
  /** 処理時間(ms) */
  elapsedMs: number;
}

/** Agent Loop 豊聡耳相談の結果 */
export interface AgentConsultResult {
  /** 相談した質問 */
  question: string;
  /** 豊聡耳の統合回答 */
  synthesis: string;
  /** 推薦アクション */
  recommendation: string;
  /** 各AIの合意点 */
  consensus: string;
  /** 相違点 */
  divergence: string;
  /** 最も優れた回答のプロバイダー */
  bestPanel?: string;
}

/** パイプライン設定 */
export interface ToyosatomiPipelineConfig {
  /** 豊聡耳で使用するAIエージェント */
  agents: ToyosatomiAgent[];
  /** ジャッジ用アダプタ（Claude推奨） */
  judgeAdapter?: ILLMAdapter;
  /** Intent-to-Rei変換用APIキー */
  converterApiKey?: string;
  /** Agent Loop で豊聡耳を発動する連続失敗回数 */
  consultThreshold?: number;
  /** ログ出力関数 */
  onLog?: (message: string, level: string) => void;
}

// ─── メインクラス ────────────────────────────────────

export class ToyosatomiPipeline {
  private engine: ToyosatomiEngine;
  private converter: IntentToReiConverter | null = null;
  private config: ToyosatomiPipelineConfig;
  private log: (message: string, level: string) => void;

  constructor(config: ToyosatomiPipelineConfig) {
    this.config = config;
    this.engine = new ToyosatomiEngine(config.judgeAdapter);
    this.log = config.onLog || ((msg, lvl) => console.log(`[ToyoPipe:${lvl}] ${msg}`));

    // Intent-to-Rei 変換器を初期化
    if (config.converterApiKey) {
      this.converter = new IntentToReiConverter({
        apiKey: config.converterApiKey,
      });
    }
  }

  // ─── 1. OCR → 豊聡耳分析 ─────────────────────────

  /**
   * OCR結果テキストを複数AIで分析する
   *
   * @param ocrText - OCRで読み取ったテキスト
   * @param analysisPrompt - 分析の指示（例: "このエラーメッセージの原因を分析して"）
   * @param useJudge - Claudeによる統合ジャッジを行うか（デフォルト: true）
   */
  async analyzeOcrText(
    ocrText: string,
    analysisPrompt: string,
    useJudge = true,
  ): Promise<ToyosatomiAnalysisResult> {
    const startTime = Date.now();

    const fullPrompt = [
      `## 画面から読み取ったテキスト`,
      `\`\`\``,
      ocrText,
      `\`\`\``,
      ``,
      `## 分析指示`,
      analysisPrompt,
    ].join('\n');

    this.log(`豊聡耳分析開始: "${analysisPrompt.substring(0, 50)}..."`, 'info');
    this.log(`OCRテキスト: "${ocrText.substring(0, 100)}..."`, 'debug');

    let panels: ToyosatomiPanelResult[] = [];
    let judge: ToyosatomiJudgeResult | undefined;

    // 全エージェントに同時問い合わせ
    panels = await this.engine.queryAll(
      this.config.agents,
      fullPrompt,
      (panel) => {
        if (panel.status === 'done') {
          this.log(`  ✓ ${panel.agent.providerName}: 回答完了`, 'debug');
        }
      },
    );

    // ジャッジ
    if (useJudge && this.config.judgeAdapter) {
      try {
        judge = await this.engine.judge(fullPrompt, panels);
        this.log(`豊聡耳ジャッジ完了`, 'info');
      } catch (err: any) {
        this.log(`ジャッジエラー: ${err.message}`, 'error');
      }
    }

    const elapsed = Date.now() - startTime;
    this.log(`豊聡耳分析完了 (${elapsed}ms)`, 'info');

    return {
      inputText: ocrText,
      prompt: analysisPrompt,
      panels,
      judge,
      elapsedMs: elapsed,
    };
  }

  // ─── 2. 豊聡耳 → スクリプト生成 → 実行 ────────────

  /**
   * 自然言語の指示を豊聡耳で相談し、統合回答をReiスクリプトに変換する
   *
   * @param userIntent - ユーザーの自然言語指示（例: "Excelを開いてA1にデータを入力して"）
   * @param screenContext - 現在の画面状態（オプション）
   * @returns 生成されたReiコードと中間結果
   */
  async generateReiFromConsensus(
    userIntent: string,
    screenContext?: string,
  ): Promise<ToyosatomiExecutionResult> {
    const startTime = Date.now();

    if (!this.converter) {
      return {
        synthesis: '',
        reiCode: '',
        conversionSuccess: false,
        reasoning: 'Intent-to-Rei 変換器が未初期化（APIキーを設定してください）',
        elapsedMs: Date.now() - startTime,
      };
    }

    // Step 1: 豊聡耳で複数AIに相談
    this.log(`豊聡耳→Rei変換開始: "${userIntent.substring(0, 50)}..."`, 'info');

    const operationPrompt = [
      `## タスク`,
      userIntent,
      ``,
      `## 回答形式`,
      `PC自動化の具体的な手順を教えてください。`,
      `操作対象のウィンドウ名、クリック座標、入力テキストなどを可能な限り具体的に記述してください。`,
      screenContext ? `\n## 現在の画面状態\n${screenContext}` : '',
    ].join('\n');

    const panels = await this.engine.queryAll(
      this.config.agents,
      operationPrompt,
      (panel) => {
        if (panel.status === 'done') {
          this.log(`  ✓ ${panel.agent.providerName}: 回答完了`, 'debug');
        }
      },
    );

    // Step 2: ジャッジ（統合回答を得る）
    let synthesis = '';
    if (this.config.judgeAdapter) {
      try {
        const judge = await this.engine.judge(operationPrompt, panels);
        synthesis = judge.synthesis;
        this.log(`ジャッジ統合完了: "${synthesis.substring(0, 80)}..."`, 'debug');
      } catch (err: any) {
        this.log(`ジャッジエラー: ${err.message}`, 'error');
        // fallback: 最初のパネルの回答を使用
        const firstDone = panels.find(p => p.status === 'done' && p.response);
        synthesis = firstDone?.response?.content || userIntent;
      }
    } else {
      // ジャッジなし: 最初の回答を使用
      const firstDone = panels.find(p => p.status === 'done' && p.response);
      synthesis = firstDone?.response?.content || userIntent;
    }

    // Step 3: 統合回答を Rei コードに変換
    const conversionInput = {
      userIntent: synthesis,
      screenContext,
      appContext: '豊聡耳モード（複数AI統合回答）からの自動変換',
    };

    const convResult = await this.converter.convertAndValidate(conversionInput);

    const elapsed = Date.now() - startTime;
    this.log(
      convResult.success
        ? `✓ Reiコード生成成功 (${elapsed}ms)`
        : `✗ Reiコード生成失敗: ${convResult.error}`,
      convResult.success ? 'info' : 'error',
    );

    return {
      synthesis,
      reiCode: convResult.reiCode,
      conversionSuccess: convResult.success,
      reasoning: convResult.reasoning,
      elapsedMs: elapsed,
    };
  }

  // ─── 3. Agent Loop 用: 迷い時の豊聡耳相談 ────────

  /**
   * Agent Loopが判断に迷った時に、複数AIに相談して最善の行動を得る
   *
   * @param currentGoal - ユーザーの目標
   * @param observation - 現在の画面状態テキスト
   * @param failedActions - 直前に失敗したアクション一覧
   * @param stepNumber - 現在のステップ番号
   */
  async consultForAgent(
    currentGoal: string,
    observation: string,
    failedActions: string[],
    stepNumber: number,
  ): Promise<AgentConsultResult> {
    const question = [
      `## 状況`,
      `PC自動操作エージェントが判断に迷っています。`,
      ``,
      `## ユーザーの目標`,
      currentGoal,
      ``,
      `## 現在の画面状態`,
      observation,
      ``,
      `## これまでに失敗したアクション`,
      failedActions.map((a, i) => `${i + 1}. ${a}`).join('\n'),
      ``,
      `## 現在のステップ`,
      `ステップ ${stepNumber}`,
      ``,
      `## 質問`,
      `次に実行すべきReiコマンド（1つだけ）を提案してください。`,
      `利用可能なコマンド: click(x,y), type("text"), key("Enter"), shortcut("Ctrl+S"),`,
      `win_activate("window"), launch("app"), wait(ms), vision_click("instruction")`,
      ``,
      `回答は「コマンド: ○○」の形式でお願いします。`,
    ].join('\n');

    this.log(`豊聡耳相談（Agent Loop ステップ${stepNumber}）`, 'info');

    const panels = await this.engine.queryAll(
      this.config.agents,
      question,
      (panel) => {
        if (panel.status === 'done') {
          this.log(`  ✓ ${panel.agent.providerName}: 提案完了`, 'debug');
        }
      },
    );

    let judge: ToyosatomiJudgeResult | undefined;
    if (this.config.judgeAdapter) {
      try {
        judge = await this.engine.judge(question, panels);
      } catch (err: any) {
        this.log(`ジャッジエラー: ${err.message}`, 'error');
      }
    }

    return {
      question,
      synthesis: judge?.synthesis || panels.find(p => p.response)?.response?.content || '',
      recommendation: judge?.recommendation || '',
      consensus: judge?.consensus || '',
      divergence: judge?.divergence || '',
      bestPanel: judge?.bestPanel,
    };
  }

  // ─── ユーティリティ ────────────────────────────────

  /** エージェント一覧を更新 */
  updateAgents(agents: ToyosatomiAgent[]): void {
    this.config.agents = agents;
  }

  /** 変換器のAPIキーを更新 */
  updateConverterKey(apiKey: string): void {
    if (this.converter) {
      this.converter.updateConfig({ apiKey });
    } else {
      this.converter = new IntentToReiConverter({ apiKey });
    }
  }

  /** 豊聡耳エンジンへの直接アクセス（高度な利用） */
  getEngine(): ToyosatomiEngine {
    return this.engine;
  }
}

// ─── ファクトリ関数 ──────────────────────────────────

let _pipelineInstance: ToyosatomiPipeline | null = null;

/**
 * シングルトンパイプラインを取得
 * AIOSEngine や runtime から呼び出す
 */
export function getToyosatomiPipeline(
  config?: ToyosatomiPipelineConfig,
): ToyosatomiPipeline | null {
  if (!_pipelineInstance && config) {
    _pipelineInstance = new ToyosatomiPipeline(config);
  }
  return _pipelineInstance;
}

/**
 * パイプラインを初期化（AIOSEngine起動時に呼ぶ）
 */
export function initToyosatomiPipeline(
  config: ToyosatomiPipelineConfig,
): ToyosatomiPipeline {
  _pipelineInstance = new ToyosatomiPipeline(config);
  return _pipelineInstance;
}

/**
 * パイプラインをリセット（テスト用）
 */
export function resetToyosatomiPipeline(): void {
  _pipelineInstance = null;
}

export default ToyosatomiPipeline;
