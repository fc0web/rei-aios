/**
 * LocalAxiomLLM — 公理OS × ローカルLLM統合レイヤー
 *
 * 既存の OllamaAdapter/LocalLLMAdapter に
 * D-FUMT公理カーネルを自動注入する統合層。
 *
 * 動作フロー:
 *   1. CompressedKernel から75理論を展開
 *   2. 七価論理の説明をシステムプロンプトに注入
 *   3. LLM応答を七価論理で分類（TRUE/FALSE/BOTH/...）
 *   4. 応答に公理IDを紐付けて説明可能性を確保
 */

import { SEED_KERNEL, type SeedTheory } from './seed-kernel';
import { type SevenLogicValue, toSymbol } from './seven-logic';

// ── 応答評価結果 ──

export interface AxiomLLMResponse {
  text: string;                    // LLMの生テキスト
  sevenLogicValue: SevenLogicValue; // 七価論理分類
  matchedAxioms: string[];         // 関連する公理ID
  confidence: SevenLogicValue;     // 信頼度
  isOffline: boolean;              // オフライン動作かどうか
  providerInfo: string;            // 使用プロバイダー情報
}

// ── プロバイダー設定 ──

export interface LocalLLMConfig {
  provider: 'ollama' | 'llama_cpp' | 'mock';
  baseUrl?: string;                // Ollama: http://localhost:11434
  model?: string;                  // モデル名
  axiomInjection?: boolean;        // 公理注入ON/OFF（デフォルト: true）
  maxAxioms?: number;              // 注入する公理数（デフォルト: 10）
}

// ── LocalAxiomLLM 本体 ──

export class LocalAxiomLLM {
  private readonly config: Required<LocalLLMConfig>;

  constructor(config: LocalLLMConfig) {
    this.config = {
      provider: config.provider,
      baseUrl: config.baseUrl ?? 'http://localhost:11434',
      model: config.model ?? 'llama3',
      axiomInjection: config.axiomInjection ?? true,
      maxAxioms: config.maxAxioms ?? 10,
    };
  }

  /**
   * 公理注入済みシステムプロンプトを生成する
   */
  buildSystemPrompt(categories?: string[]): string {
    const axioms = this.selectAxioms(categories);
    const axiomText = axioms
      .map(a => `  [${a.id}] ${a.axiom} (${a.keywords.join(', ')})`)
      .join('\n');

    return [
      'あなたはRei-AIOSの公理ベースAIアシスタントです。',
      '以下のD-FUMT理論公理を推論の根拠として使用してください。',
      '',
      '【D-FUMT公理カーネル（抜粋）】',
      axiomText,
      '',
      '【七価論理で応答を評価してください】',
      '  ⊤（TRUE）= 確実に正しい',
      '  ⊥（FALSE）= 確実に誤り',
      '  B（BOTH）= 矛盾を含む・文脈依存',
      '  N（NEITHER）= 判断保留',
      '  ∞（INFINITY）= 評価不能・無限後退',
      '  〇（ZERO）= 未観測・情報不足',
      '  ～（FLOWING）= 変化中・条件付き',
      '',
      '応答の末尾に必ず [七価: X] 形式で評価値を記してください。',
    ].join('\n');
  }

  /**
   * モック応答を生成する（テスト用・オフライン確認用）
   * 実際のOllamaが使用可能な場合はそちらに委譲
   */
  async complete(
    userMessage: string,
    categories?: string[],
  ): Promise<AxiomLLMResponse> {
    const systemPrompt = this.config.axiomInjection
      ? this.buildSystemPrompt(categories)
      : undefined;

    // provider に応じて処理を分岐
    if (this.config.provider === 'mock') {
      return this.mockComplete(userMessage, systemPrompt);
    }

    // Ollama への実際のリクエスト（ネットワーク利用可能な場合）
    try {
      return await this.ollamaComplete(userMessage, systemPrompt);
    } catch {
      // Ollama 不在時はモックにフォールバック
      return this.mockComplete(userMessage, systemPrompt, true);
    }
  }

  /**
   * 接続状態を確認する
   */
  async healthCheck(): Promise<{
    available: boolean;
    provider: string;
    model: string;
    axiomCount: number;
  }> {
    let available = false;
    if (this.config.provider === 'ollama') {
      try {
        const res = await fetch(`${this.config.baseUrl}/api/tags`, {
          signal: AbortSignal.timeout(2000),
        });
        available = res.ok;
      } catch { available = false; }
    } else if (this.config.provider === 'mock') {
      available = true;
    }
    return {
      available,
      provider: this.config.provider,
      model: this.config.model,
      axiomCount: SEED_KERNEL.length,
    };
  }

  /**
   * LLMテキスト応答を七価論理値に分類する
   */
  classifyResponse(text: string): SevenLogicValue {
    const lower = text.toLowerCase();
    // [七価: X] パターンを探す
    const match = text.match(/\[七価:\s*([⊤⊥BNTF∞〇～BOTH NEITHER INFINITY ZERO FLOWING TRUE FALSE]+)\]/);
    if (match) {
      const val = match[1].trim();
      if (val === '⊤' || val === 'TRUE')      return 'TRUE';
      if (val === '⊥' || val === 'FALSE')     return 'FALSE';
      if (val === 'B' || val === 'BOTH')       return 'BOTH';
      if (val === 'N' || val === 'NEITHER')    return 'NEITHER';
      if (val === '∞' || val === 'INFINITY')   return 'INFINITY';
      if (val === '〇' || val === 'ZERO')      return 'ZERO';
      if (val === '～' || val === 'FLOWING')   return 'FLOWING';
    }
    // パターンなし: テキストの感情トーンで推定
    if (lower.includes('はい') || lower.includes('正しい') || lower.includes('yes')) return 'TRUE';
    if (lower.includes('いいえ') || lower.includes('誤り') || lower.includes('no'))  return 'FALSE';
    if (lower.includes('矛盾') || lower.includes('両方'))                             return 'BOTH';
    if (lower.includes('不明') || lower.includes('わかりません'))                     return 'NEITHER';
    if (lower.includes('変化') || lower.includes('条件次第'))                         return 'FLOWING';
    return 'ZERO'; // デフォルト: 未観測
  }

  /**
   * 公理との関連度でマッチング
   */
  matchAxioms(text: string): string[] {
    return SEED_KERNEL
      .filter(a => a.keywords.some(kw => text.includes(kw)))
      .map(a => a.id)
      .slice(0, 3);
  }

  // ── プライベートメソッド ──

  private selectAxioms(categories?: string[]): SeedTheory[] {
    const filtered = categories
      ? SEED_KERNEL.filter(a => categories.includes(a.category))
      : SEED_KERNEL;
    return filtered.slice(0, this.config.maxAxioms);
  }

  private async ollamaComplete(
    userMessage: string,
    systemPrompt?: string,
  ): Promise<AxiomLLMResponse> {
    const messages: Array<{role: string; content: string}> = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: userMessage });

    const res = await fetch(`${this.config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.config.model, messages, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json() as { message?: { content?: string } };
    const text = data.message?.content ?? '';

    return {
      text,
      sevenLogicValue: this.classifyResponse(text),
      matchedAxioms: this.matchAxioms(text),
      confidence: 'TRUE',
      isOffline: true,
      providerInfo: `ollama/${this.config.model}`,
    };
  }

  private mockComplete(
    userMessage: string,
    systemPrompt?: string,
    isFallback = false,
  ): AxiomLLMResponse {
    // キーワードベースのモック応答生成
    const axiomMatches = this.matchAxioms(userMessage);
    const topAxiom = axiomMatches[0]
      ? SEED_KERNEL.find(a => a.id === axiomMatches[0])
      : null;

    const text = [
      `【モック応答】入力: 「${userMessage.slice(0, 30)}...」`,
      topAxiom
        ? `関連公理: ${topAxiom.id}（${topAxiom.axiom}）`
        : '関連公理: 汎用推論を適用',
      `D-FUMT公理カーネル（${SEED_KERNEL.length}理論）を参照しました。`,
      '[七価: ～]',
    ].join('\n');

    return {
      text,
      sevenLogicValue: 'FLOWING',
      matchedAxioms: axiomMatches,
      confidence: isFallback ? 'NEITHER' : 'FLOWING',
      isOffline: true,
      providerInfo: isFallback ? `mock(fallback from ollama)` : 'mock',
    };
  }
}
