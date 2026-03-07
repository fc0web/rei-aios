/**
 * NoAxiomVoid — 無公理状態（ZERO）の形式化
 *
 * D-FUMT Theory #79: 無公理ZERO理論
 * 「全ての公理は ZERO 状態から生まれ、
 *  ZERO 状態に戻ることができる」
 *
 * 3つの機能:
 *   1. VoidState  : ZERO状態を形式化・管理する
 *   2. Emergence  : ZERO から公理が「現れる」過程を追跡
 *   3. Return     : 公理が ZERO に「戻る」過程（廃棄の純化）
 *
 * 他モジュールとの関係:
 *   MoiraTerminator.atropos() → 廃棄 → NoAxiomVoid.returnToVoid()
 *   AntiAxiomEngine           → 反公理 → NoAxiomVoid からの再出発
 *   TheoremDeriver            → 演繹 → NoAxiomVoid が出発点
 *   NarcissusDetector         → ループ検出 → Void に戻ってリセット
 */

import { type SeedTheory, SEED_KERNEL } from './seed-kernel';
import { type SevenLogicValue, toSymbol } from './seven-logic';

// ── Void状態のスナップショット ──
export interface VoidSnapshot {
  id: string;
  capturedAt: number;
  potentialTheories: string[];   // ZERO から生まれ得る理論ID群
  entropyBits: number;           // H = log2(potentialTheories.length)
  logicTag: 'ZERO';              // 常に ZERO
  description: string;
}

// ── 公理の現れ（EmergenceEvent）──
export interface EmergenceEvent {
  id: string;
  fromVoidId: string;       // どの ZERO 状態から現れたか
  theory: SeedTheory;       // 現れた公理
  trigger: string;          // 現れのきっかけ
  emergenceValue: SevenLogicValue; // 現れた瞬間の値（FLOWING→TRUE）
  emergedAt: number;
}

// ── Void への帰還（ReturnEvent）──
export interface ReturnEvent {
  id: string;
  theoryId: string;         // どの公理が帰還したか
  reason: string;           // 帰還の理由
  residue: string;          // 帰還後に残るもの（キーワード等）
  returnedAt: number;
  newVoidId: string;        // 帰還先の新しい VOID ID
}

// ── ZERO サイクル（公理の一生） ──
export interface ZeroCycle {
  theoryId: string;
  emerged: EmergenceEvent;
  returned?: ReturnEvent;
  cycleComplete: boolean;
  duration?: number;        // 存在した時間（ms）
}

export class NoAxiomVoid {
  private voids: Map<string, VoidSnapshot> = new Map();
  private emergences: EmergenceEvent[] = [];
  private returns: ReturnEvent[] = [];
  private counter = 0;

  // ══════════════════════════════════════════════════════════════
  // ZERO状態の管理
  // ══════════════════════════════════════════════════════════════

  /**
   * 現在の SEED_KERNEL から ZERO 状態を生成する
   * （全公理が「潜在的に存在する」状態）
   */
  captureVoid(label = 'primary'): VoidSnapshot {
    const id = `void-${++this.counter}-${label}`;
    const potentialTheories = SEED_KERNEL.map(t => t.id);
    // シャノンエントロピー
    const entropyBits = Math.log2(Math.max(potentialTheories.length, 1));

    const snapshot: VoidSnapshot = {
      id,
      capturedAt: Date.now(),
      potentialTheories,
      entropyBits,
      logicTag: 'ZERO',
      description: `${potentialTheories.length}理論が潜在する ZERO 状態 (H=${entropyBits.toFixed(3)} bits)`,
    };
    this.voids.set(id, snapshot);
    return snapshot;
  }

  /**
   * 空の ZERO 状態を生成する（全ての公理が存在する前）
   * D-FUMTの「宇宙創生前」を表現する
   */
  primordialVoid(): VoidSnapshot {
    const id = `void-primordial-${++this.counter}`;
    const snapshot: VoidSnapshot = {
      id,
      capturedAt: Date.now(),
      potentialTheories: [],
      entropyBits: 0,
      logicTag: 'ZERO',
      description: '根源的 ZERO——公理が存在する前の状態',
    };
    this.voids.set(id, snapshot);
    return snapshot;
  }

  // ══════════════════════════════════════════════════════════════
  // 現れと帰還
  // ══════════════════════════════════════════════════════════════

  /**
   * ZERO 状態から公理が「現れる」
   * MoiraTerminator.clotho() の前に呼ぶ
   */
  emerge(
    voidId: string,
    theory: SeedTheory,
    trigger: string,
  ): EmergenceEvent {
    const event: EmergenceEvent = {
      id: `emerge-${++this.counter}`,
      fromVoidId: voidId,
      theory,
      trigger,
      emergenceValue: 'FLOWING', // 現れた直後は FLOWING（確定前）
      emergedAt: Date.now(),
    };
    this.emergences.push(event);
    return event;
  }

  /**
   * 公理が ZERO 状態に「帰還する」
   * MoiraTerminator.atropos() の後に呼ぶ
   * （廃棄ではなく「純化」として扱う）
   */
  returnToVoid(
    theoryId: string,
    reason: string,
  ): ReturnEvent {
    const theory = SEED_KERNEL.find(t => t.id === theoryId);
    // 帰還後に残るもの（キーワードを残滓として保持）
    const residue = theory?.keywords.join(', ') ?? '（キーワードなし）';
    const newVoid = this.captureVoid(`after-${theoryId}`);

    const event: ReturnEvent = {
      id: `return-${++this.counter}`,
      theoryId,
      reason,
      residue,
      returnedAt: Date.now(),
      newVoidId: newVoid.id,
    };
    this.returns.push(event);
    return event;
  }

  // ══════════════════════════════════════════════════════════════
  // ZEROサイクルの追跡
  // ══════════════════════════════════════════════════════════════

  /**
   * 公理の「一生」（ZERO→現れ→帰還→ZERO）を追跡する
   */
  getCycle(theoryId: string): ZeroCycle | null {
    const emerged = this.emergences.find(e => e.theory.id === theoryId);
    if (!emerged) return null;

    const returned = this.returns.find(r => r.theoryId === theoryId);
    const cycleComplete = !!returned;
    const duration = returned
      ? returned.returnedAt - emerged.emergedAt
      : undefined;

    return { theoryId, emerged, returned, cycleComplete, duration };
  }

  /**
   * 全理論の ZERO サイクル完結率を返す
   */
  cycleCompletionRate(): number {
    const total = this.emergences.length;
    if (total === 0) return 0;
    const completed = this.emergences.filter(
      e => this.returns.some(r => r.theoryId === e.theory.id),
    ).length;
    return completed / total;
  }

  /**
   * 現在の ZERO 状態の七価サマリーを返す
   */
  summary(): {
    voidCount: number;
    emergenceCount: number;
    returnCount: number;
    cycleCompletionRate: number;
    currentEntropy: number;
    overallTag: SevenLogicValue;
  } {
    const latest = [...this.voids.values()].sort((a, b) => b.capturedAt - a.capturedAt)[0];
    const rate = this.cycleCompletionRate();
    const overallTag: SevenLogicValue =
      rate >= 1.0  ? 'TRUE'    :
      rate >= 0.5  ? 'FLOWING' :
      rate > 0     ? 'NEITHER' :
                     'ZERO';

    return {
      voidCount: this.voids.size,
      emergenceCount: this.emergences.length,
      returnCount: this.returns.length,
      cycleCompletionRate: rate,
      currentEntropy: latest?.entropyBits ?? 0,
      overallTag,
    };
  }
}
