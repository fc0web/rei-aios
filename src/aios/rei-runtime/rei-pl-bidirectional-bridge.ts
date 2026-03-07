/**
 * Rei-AIOS — ReiPLBidirectionalBridge
 * 「SEED_KERNEL公理 → Rei-PLコード生成 → 実行 → AIOSMemory保存」
 * の双方向ループを1クラスで管理する。
 */

import { SEED_KERNEL, type SeedTheory } from '../../axiom-os/seed-kernel';
import { ReiPLAxiomGenerator, type GeneratedCode } from '../../axiom-os/rei-pl-axiom-generator';
import { ReiPLAIOSConnector } from './rei-pl-aios-connector';
import { ReiAIOSRuntimeBus } from '../rei-aios-runtime-bus';
import { AIOSMemory } from '../../memory/aios-memory';

export interface BridgeRunOptions {
  theoryIds?:  string[];   // 対象理論ID（省略時: 全理論）
  maxTheories: number;     // 最大実行数（デフォルト: 10）
  agentId:     string;     // 記憶の保存先エージェントID
  dryRun?:     boolean;    // trueの場合、コード生成のみ（実行しない）
}

export interface BridgeRunResult {
  processed: number;
  succeeded: number;
  failed:    number;
  memories:  string[];    // 保存した記憶ID
  codes:     GeneratedCode[];
  errors:    string[];
}

export class ReiPLBidirectionalBridge {
  private generator: ReiPLAxiomGenerator;
  private connector: ReiPLAIOSConnector;
  private memory:    AIOSMemory;

  constructor(
    bus:    ReiAIOSRuntimeBus,
    memory: AIOSMemory,
  ) {
    this.generator = new ReiPLAxiomGenerator();
    this.connector = new ReiPLAIOSConnector(bus);
    this.memory    = memory;
  }

  /**
   * 公理 → コード生成 → 実行 → 記憶保存
   */
  async run(opts: BridgeRunOptions): Promise<BridgeRunResult> {
    const result: BridgeRunResult = {
      processed: 0,
      succeeded: 0,
      failed:    0,
      memories:  [],
      codes:     [],
      errors:    [],
    };

    // 対象理論を選択
    let theories: SeedTheory[] = SEED_KERNEL;
    if (opts.theoryIds && opts.theoryIds.length > 0) {
      theories = SEED_KERNEL.filter(t => opts.theoryIds!.includes(t.id));
    }
    theories = theories.slice(0, opts.maxTheories);

    for (const theory of theories) {
      result.processed++;

      // ── 1. Rei-PLコード生成 ─────────────────────────
      const generated = this.generator.generate(theory);
      result.codes.push(generated);

      if (opts.dryRun) continue;

      // ── 2. 実行 ──────────────────────────────────────
      try {
        const execResult = await this.connector.execute(
          generated.reiCode,
          `bridge:${theory.id}`
        );

        // ── 3. AIOSMemoryに記憶保存 ──────────────────
        const memEntry = this.memory.remember(
          opts.agentId,
          'axiom',
          `[${theory.id}] ${theory.axiom} → 実行結果: ${execResult.output.trim().slice(0, 80)}`,
          {
            confidence: execResult.success ? execResult.logicValue : 'FALSE',
            tags: ['rei-pl', 'axiom', theory.category, ...theory.keywords.slice(0, 3)],
          }
        );

        result.memories.push(memEntry.id);
        result.succeeded++;

      } catch (err: any) {
        result.failed++;
        result.errors.push(`${theory.id}: ${err.message}`);
      }
    }

    return result;
  }

  /**
   * コード生成のみ（実行なし）
   */
  generateOnly(opts: {
    theoryIds?: string[];
    maxTheories?: number;
  } = {}): BridgeRunResult {
    let theories: SeedTheory[] = SEED_KERNEL;
    if (opts.theoryIds && opts.theoryIds.length > 0) {
      theories = SEED_KERNEL.filter(t => opts.theoryIds!.includes(t.id));
    }
    theories = theories.slice(0, opts.maxTheories ?? 10);

    const codes = theories.map(t => this.generator.generate(t));

    return {
      processed: theories.length,
      succeeded: theories.length,
      failed: 0,
      memories: [],
      codes,
      errors: [],
    };
  }

  /**
   * コード生成のみ（実行なし）— モジュール形式
   */
  generateModule(theoryIds?: string[]): string {
    const theories = theoryIds
      ? SEED_KERNEL.filter(t => theoryIds.includes(t.id))
      : SEED_KERNEL;
    return this.generator.generateModule(theories);
  }
}
