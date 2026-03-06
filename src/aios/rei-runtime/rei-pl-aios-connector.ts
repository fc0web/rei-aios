/**
 * ReiPLAIOSConnector
 *
 * rei-pl の実行結果を ReiAIOSRuntimeBus に接続する。
 * rei-pl-bridge.ts（コンパイル層）と RuntimeBus（推論層）の間を埋める。
 */

import { compileAndRun, compileWithDetails, ReiPLBridgeError } from '../../rei-pl-bridge';
import { ReiAIOSRuntimeBus } from '../rei-aios-runtime-bus';
import { type SevenLogicValue } from '../../axiom-os/seven-logic';

export interface ReiExecutionResult {
  source: string;
  output: string;
  success: boolean;
  busOutput?: unknown;           // RuntimeBus の応答
  logicValue: SevenLogicValue;   // 実行結果の七価解釈
  wasmBytes: number;
  error?: string;
}

export class ReiPLAIOSConnector {
  constructor(private readonly bus: ReiAIOSRuntimeBus) {}

  /**
   * Rei ソースを実行し、結果を RuntimeBus に発火する。
   *
   * 変換ルール（実行結果 → SevenLogicValue）:
   *   success + 出力あり    → TRUE
   *   success + 出力なし    → ZERO
   *   コンパイルエラー      → FALSE
   *   例外・クラッシュ      → NEITHER
   *   出力に "both"         → BOTH
   *   出力に "flowing"/"～" → FLOWING
   *   出力に "∞"/"infinity" → INFINITY
   */
  async execute(source: string, context = 'rei-pl'): Promise<ReiExecutionResult> {
    let logicValue: SevenLogicValue = 'ZERO';
    let wasmBytes = 0;

    try {
      const details = await compileWithDetails(source);
      wasmBytes = details.stats.wasmBytes;

      const runResult = await compileAndRun(source);
      const out = runResult.output.toLowerCase();

      // 出力内容から七価論理値を推定
      if (!runResult.success) {
        logicValue = 'FALSE';
      } else if (out.includes('both') || out.includes('\u22A4') && out.includes('\u22A5')) {
        logicValue = 'BOTH';
      } else if (out.includes('flowing') || out.includes('\uFF5E')) {
        logicValue = 'FLOWING';
      } else if (out.includes('\u221E') || out.includes('infinity')) {
        logicValue = 'INFINITY';
      } else if (out.includes('neither') || out.includes('\u7121\u8A18')) {
        logicValue = 'NEITHER';
      } else if (runResult.output.trim().length > 0) {
        logicValue = 'TRUE';
      } else {
        logicValue = 'ZERO';
      }

      // RuntimeBus に inference イベントとして発火
      const busOutput = this.bus.publish({
        type: 'inference',
        source: context,
        timestamp: Date.now(),
        payload: {
          question: source.slice(0, 80),          // ソースの先頭80文字を「問い」として
          depth: details.stats.astNodes,           // ASTノード数を深度として
          axiomIds: this.extractAxiomRefs(source), // axiom参照を抽出
          logicValues: [logicValue],
          result: logicValue,
        },
      });

      return {
        source,
        output: runResult.output,
        success: runResult.success,
        busOutput,
        logicValue,
        wasmBytes,
        error: runResult.error,
      };

    } catch (e: any) {
      logicValue = e instanceof ReiPLBridgeError ? 'FALSE' : 'NEITHER';

      // エラーも RuntimeBus に記録
      this.bus.publish({
        type: 'inference',
        source: context,
        timestamp: Date.now(),
        payload: {
          question: source.slice(0, 80),
          depth: 0,
          axiomIds: [],
          logicValues: [logicValue],
          result: logicValue,
        },
      });

      return {
        source,
        output: '',
        success: false,
        logicValue,
        wasmBytes,
        error: e.message,
      };
    }
  }

  /**
   * space 構文を実行し、ReiSpace スナップショットとして Bus に発火する。
   */
  async executeSpace(
    spaceName: string,
    dimensions: string[],
    values: Record<string, number | null>,
  ): Promise<void> {
    const tags = dimensions.map(dim => {
      const v = values[dim];
      return v === null ? 'ZERO' :
             v === 0    ? 'ZERO' :
             v > 0      ? 'TRUE' : 'FALSE';
    }) as SevenLogicValue[];

    const allTags = new Set(tags);
    const overallTag: SevenLogicValue =
      allTags.has('NEITHER') ? 'NEITHER' :
      allTags.has('BOTH')    ? 'BOTH'    :
      allTags.has('FALSE')   ? 'FALSE'   :
      allTags.has('FLOWING') ? 'FLOWING' :
      allTags.size === 1 && allTags.has('ZERO') ? 'ZERO' : 'TRUE';

    const phi = tags.filter(t => t === 'TRUE').length / Math.max(tags.length, 1);

    this.bus.publish({
      type: 'space_snapshot',
      source: `rei-space:${spaceName}`,
      timestamp: Date.now(),
      payload: {
        spaceName,
        overallTag,
        phi,
        dimensions: dimensions.map((name, i) => ({
          name,
          value: values[name] ?? null,
          logicTag: tags[i],
        })),
      },
    });
  }

  /** Rei ソースから axiom 参照を抽出する */
  private extractAxiomRefs(source: string): string[] {
    const matches = source.match(/axiom\s+"([^"]+)"/g) ?? [];
    return matches.map(m => m.replace(/axiom\s+"([^"]+)"/, '$1'));
  }
}
