/**
 * ExplainabilityEngine — 公理チェーンによる説明可能性エンジン
 *
 * D-FUMT設計思想の具現化：
 *   「自然言語が問いを立て、数式が構造を掘る」
 *   → AIの判断を公理チェーンで可視化し、自然言語で説明する
 *
 * 機能：
 *   1. 推論ステップを公理IDと七価論理値で記録
 *   2. 公理チェーン（根拠の連鎖）を構築
 *   3. 人間可読な説明文を自動生成
 *   4. 信頼度を七価論理で表現
 */

import { SEED_KERNEL, type SeedTheory } from './seed-kernel';
import { type SevenLogicValue, toSymbol } from './seven-logic';

// ── 推論ステップ ──

export interface ReasoningStep {
  stepId: string;              // ステップID
  axiomId: string;             // 使用した公理ID
  axiomText: string;           // 公理のテキスト
  inputValue: SevenLogicValue; // 入力値
  outputValue: SevenLogicValue;// 出力値
  operation: string;           // 実行した操作（例: "□適用", "Ω収束"）
  confidence: SevenLogicValue; // このステップの信頼度
  note?: string;               // 補足説明
}

// ── 公理チェーン ──

export interface AxiomChain {
  chainId: string;
  question: string;            // 元の問い（自然言語）
  conclusion: SevenLogicValue; // 最終結論
  steps: ReasoningStep[];      // 推論ステップの列
  overallConfidence: SevenLogicValue;
  createdAt: number;
}

// ── 説明レポート ──

export interface ExplanationReport {
  chain: AxiomChain;
  summary: string;             // 1行サマリー
  detail: string;              // 詳細説明（自然言語）
  axiomRefs: string[];         // 参照した公理ID一覧
  logicFlow: string;           // 七価論理の流れ（記号）
}

// ── ExplainabilityEngine 本体 ──

export class ExplainabilityEngine {
  private readonly chains: Map<string, AxiomChain> = new Map();
  private stepCounter = 0;
  private chainCounter = 0;

  /** 新しい推論チェーンを開始する */
  startChain(question: string): string {
    const chainId = `chain-${++this.chainCounter}-${Date.now()}`;
    const chain: AxiomChain = {
      chainId,
      question,
      conclusion: 'ZERO',  // 初期値は〇（未観測）
      steps: [],
      overallConfidence: 'ZERO',
      createdAt: Date.now(),
    };
    this.chains.set(chainId, chain);
    return chainId;
  }

  /**
   * 推論ステップを記録する
   * 公理IDと七価論理値を紐付けて追跡
   */
  recordStep(
    chainId: string,
    axiomId: string,
    input: SevenLogicValue,
    output: SevenLogicValue,
    operation: string,
    note?: string,
  ): ReasoningStep | null {
    const chain = this.chains.get(chainId);
    if (!chain) return null;

    const axiom = this.findAxiom(axiomId);
    const step: ReasoningStep = {
      stepId: `step-${++this.stepCounter}`,
      axiomId,
      axiomText: axiom?.axiom ?? axiomId,
      inputValue: input,
      outputValue: output,
      operation,
      confidence: this.inferStepConfidence(input, output),
      note,
    };

    chain.steps.push(step);
    chain.conclusion = output;
    chain.overallConfidence = this.calcOverallConfidence(chain.steps);
    return step;
  }

  /**
   * チェーンを完結させ説明レポートを生成する
   */
  finalize(chainId: string): ExplanationReport | null {
    const chain = this.chains.get(chainId);
    if (!chain) return null;

    return {
      chain,
      summary: this.generateSummary(chain),
      detail: this.generateDetail(chain),
      axiomRefs: [...new Set(chain.steps.map(s => s.axiomId))],
      logicFlow: this.generateLogicFlow(chain),
    };
  }

  /**
   * 公理IDのリストから自動的にチェーンを構築する
   * （簡易版：公理を順番に適用して結論を導出）
   */
  buildChain(
    question: string,
    axiomIds: string[],
    initialValue: SevenLogicValue = 'ZERO',
  ): ExplanationReport | null {
    const chainId = this.startChain(question);
    let current = initialValue;

    for (const axiomId of axiomIds) {
      const axiom = this.findAxiom(axiomId);
      if (!axiom) continue;

      const next = this.applyAxiom(axiom, current);
      this.recordStep(
        chainId,
        axiomId,
        current,
        next,
        `公理「${axiom.keywords[0] ?? axiomId}」を適用`,
      );
      current = next;
    }

    return this.finalize(chainId);
  }

  /** 全チェーンを取得 */
  getAll(): AxiomChain[] {
    return [...this.chains.values()];
  }

  /** 特定チェーンを取得 */
  getChain(chainId: string): AxiomChain | undefined {
    return this.chains.get(chainId);
  }

  // ── プライベートメソッド ──

  private findAxiom(axiomId: string): SeedTheory | undefined {
    return SEED_KERNEL.find(s => s.id === axiomId);
  }

  /**
   * 公理を七価論理値に適用する（簡易意味論）
   * 公理のカテゴリと入力値から出力値を決定
   */
  private applyAxiom(axiom: SeedTheory, input: SevenLogicValue): SevenLogicValue {
    switch (axiom.category) {
      case 'logic':
        // 論理系公理: FLOWING→TRUE（流動を確定に）
        if (input === 'FLOWING') return 'TRUE';
        if (input === 'ZERO')    return 'NEITHER';
        return input;
      case 'computation':
        // 計算系公理（冪等性など）: BOTH→TRUE（収束）
        if (input === 'BOTH')    return 'TRUE';
        if (input === 'INFINITY') return 'TRUE';
        return input;
      case 'consciousness':
        // 意識系公理: ZERO→FLOWING（潜在→流動）
        if (input === 'ZERO')    return 'FLOWING';
        if (input === 'NEITHER') return 'FLOWING';
        return input;
      case 'zero_extension':
        // ゼロ拡張: ZERO→TRUE（ゼロから実在へ）
        if (input === 'ZERO')    return 'TRUE';
        return input;
      case 'expansion':
        // 拡張: TRUE→FLOWING（確定→流動的拡張）
        if (input === 'TRUE')    return 'FLOWING';
        return input;
      default:
        return input;
    }
  }

  private inferStepConfidence(
    input: SevenLogicValue,
    output: SevenLogicValue,
  ): SevenLogicValue {
    if (input === output)        return 'TRUE';    // 変化なし=確実
    if (output === 'BOTH')       return 'FLOWING'; // 矛盾=流動的
    if (output === 'NEITHER')    return 'NEITHER'; // 無記=不確実
    if (output === 'INFINITY')   return 'FLOWING'; // 無限=流動的
    return 'FLOWING';
  }

  private calcOverallConfidence(steps: ReasoningStep[]): SevenLogicValue {
    if (steps.length === 0) return 'ZERO';
    const hasContradiction = steps.some(s => s.outputValue === 'BOTH');
    const hasInfinity     = steps.some(s => s.outputValue === 'INFINITY');
    const allTrue         = steps.every(s => s.confidence === 'TRUE');
    if (hasContradiction) return 'BOTH';
    if (hasInfinity)      return 'FLOWING';
    if (allTrue)          return 'TRUE';
    return 'FLOWING';
  }

  private generateSummary(chain: AxiomChain): string {
    const sym = toSymbol(chain.conclusion);
    const conf = toSymbol(chain.overallConfidence);
    return `「${chain.question}」→ 結論: ${sym}（信頼度: ${conf}、${chain.steps.length}ステップ）`;
  }

  private generateDetail(chain: AxiomChain): string {
    if (chain.steps.length === 0) {
      return `「${chain.question}」に対して適用できる公理がありませんでした。`;
    }
    const lines = [
      `問い: 「${chain.question}」`,
      `推論過程（${chain.steps.length}ステップ）:`,
    ];
    chain.steps.forEach((step, i) => {
      lines.push(
        `  ${i + 1}. ${step.operation}`
        + ` [${step.axiomId}]`
        + `: ${toSymbol(step.inputValue)} → ${toSymbol(step.outputValue)}`
        + (step.note ? ` （${step.note}）` : ''),
      );
    });
    lines.push(`結論: ${toSymbol(chain.conclusion)}`);
    lines.push(`総合信頼度: ${toSymbol(chain.overallConfidence)}`);
    return lines.join('\n');
  }

  private generateLogicFlow(chain: AxiomChain): string {
    if (chain.steps.length === 0) return '〇';
    const values = [chain.steps[0].inputValue, ...chain.steps.map(s => s.outputValue)];
    return values.map(v => toSymbol(v)).join(' → ');
  }
}
