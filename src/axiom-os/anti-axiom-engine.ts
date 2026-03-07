/**
 * AntiAxiomEngine — 反公理エンジン
 *
 * D-FUMT Theory #77: 反公理生成理論
 * 「公理 A の否定 ¬A は、A と BOTH 状態で共存し、
 *  新しい数学体系を生成する可能性を持つ」
 *
 * ユークリッド→非ユークリッド幾何学の歴史的事実を
 * D-FUMTの形式論理として実装する。
 *
 * 反公理の3類型:
 *   NEGATE    : 公理を単純に否定（¬A）
 *   WEAKEN    : 公理の条件を緩める（A の一部を除去）
 *   EXTEND    : 公理を別次元に拡張（A を超える）
 *
 * ContradictionDetector との連携:
 *   公理と反公理が同時に存在 → BOTH → ContradictionDetector.detect()
 *   BOTH が解決されず残る    → 新体系の萌芽として記録
 */

import { type SeedTheory, SEED_KERNEL } from './seed-kernel';
import { type SevenLogicValue, toSymbol } from './seven-logic';

// ── 反公理の類型 ──
export type AntiAxiomKind = 'NEGATE' | 'WEAKEN' | 'EXTEND';

// ── 反公理 ──
export interface AntiAxiom {
  id: string;                   // anti-{元理論id}
  sourceId: string;             // 元の公理ID
  kind: AntiAxiomKind;
  antiAxiom: string;            // 反公理テキスト
  category: string;
  keywords: string[];
  logicRelation: SevenLogicValue; // 元公理との関係（通常BOTH）
  newSystemName?: string;       // 生まれる可能性のある新体系名
  createdAt: number;
  note: string;
}

// ── 新体系の候補 ──
export interface EmergentSystem {
  name: string;
  sourceAxiomId: string;
  antiAxiomId: string;
  description: string;
  logicTag: SevenLogicValue;    // この体系の成熟度
  theories: string[];           // 体系を構成する理論ID群
}

// ── 反公理生成結果 ──
export interface AntiAxiomResult {
  original: SeedTheory;
  antiAxioms: AntiAxiom[];
  emergentSystem?: EmergentSystem;
  bothState: boolean;           // 元公理と反公理がBOTH状態か
}

export class AntiAxiomEngine {
  private antiAxioms: Map<string, AntiAxiom> = new Map();
  private emergentSystems: EmergentSystem[] = [];
  private counter = 0;

  // ══════════════════════════════════════════════════════════════
  // 反公理の生成
  // ══════════════════════════════════════════════════════════════

  /**
   * 公理から3類型の反公理を生成する
   */
  generate(theory: SeedTheory): AntiAxiomResult {
    const antiAxioms: AntiAxiom[] = [
      this.negate(theory),
      this.weaken(theory),
      this.extend(theory),
    ];

    for (const aa of antiAxioms) {
      this.antiAxioms.set(aa.id, aa);
    }

    // 反公理が生まれた時点で元公理とBOTH状態になる
    const bothState = true;

    // 新体系の可能性を評価
    const emergentSystem = this.evalEmergent(theory, antiAxioms);
    if (emergentSystem) this.emergentSystems.push(emergentSystem);

    return { original: theory, antiAxioms, emergentSystem, bothState };
  }

  /**
   * SEED_KERNEL全体から反公理を生成する
   * （D-FUMT全体系の「影」を生成する）
   */
  generateAll(theoryIds?: string[]): AntiAxiomResult[] {
    const targets = theoryIds
      ? SEED_KERNEL.filter(t => theoryIds.includes(t.id))
      : SEED_KERNEL;
    return targets.map(t => this.generate(t));
  }

  /**
   * 反公理から新しい SeedTheory を生成する
   * （TheoryEvolution と連携して SEED_KERNEL に追加可能な形に変換）
   */
  toSeedTheory(anti: AntiAxiom): SeedTheory {
    return {
      id: anti.id,
      axiom: anti.antiAxiom,
      category: anti.category,
      keywords: anti.keywords,
    };
  }

  getAntiAxioms(): AntiAxiom[] { return [...this.antiAxioms.values()]; }
  getEmergentSystems(): EmergentSystem[] { return [...this.emergentSystems]; }

  // ── NEGATE: 単純否定 ──
  private negate(theory: SeedTheory): AntiAxiom {
    const id = `anti-negate-${theory.id}-${++this.counter}`;
    const antiAxiom = `¬[${theory.axiom}]`;
    return {
      id, sourceId: theory.id, kind: 'NEGATE',
      antiAxiom,
      category: theory.category,
      keywords: [...theory.keywords, '否定', 'negation'],
      logicRelation: 'BOTH',  // 元公理とBOTH状態
      createdAt: Date.now(),
      note: `${theory.id} の単純否定。元公理と BOTH 状態で共存。`,
    };
  }

  // ── WEAKEN: 条件の緩和 ──
  private weaken(theory: SeedTheory): AntiAxiom {
    const id = `anti-weaken-${theory.id}-${++this.counter}`;
    const antiAxiom = `[${theory.axiom}] の条件を緩和: 一部の例外を許容する`;
    return {
      id, sourceId: theory.id, kind: 'WEAKEN',
      antiAxiom,
      category: theory.category,
      keywords: [...theory.keywords, '緩和', 'weakening', '例外'],
      logicRelation: 'FLOWING',  // 元公理から流動して変化
      createdAt: Date.now(),
      note: `${theory.id} の条件緩和版。例外・境界ケースを扱う。`,
    };
  }

  // ── EXTEND: 別次元への拡張 ──
  private extend(theory: SeedTheory): AntiAxiom {
    const id = `anti-extend-${theory.id}-${++this.counter}`;
    const antiAxiom = `[${theory.axiom}] を超える: より高次元での一般化`;
    return {
      id, sourceId: theory.id, kind: 'EXTEND',
      antiAxiom,
      category: theory.category,
      keywords: [...theory.keywords, '拡張', 'extension', '一般化'],
      logicRelation: 'INFINITY',  // 無限に拡張する可能性
      createdAt: Date.now(),
      note: `${theory.id} の高次元拡張。新体系の種となる可能性あり。`,
    };
  }

  // ── 新体系の可能性を評価 ──
  private evalEmergent(
    theory: SeedTheory,
    antiAxioms: AntiAxiom[],
  ): EmergentSystem | null {
    // EXTEND 型の反公理がある場合のみ新体系候補を生成
    const extendAnti = antiAxioms.find(a => a.kind === 'EXTEND');
    if (!extendAnti) return null;

    // カテゴリ別の新体系名マップ
    const systemNames: Record<string, string> = {
      'logic':          `非${theory.id}論理系`,
      'mathematics':    `拡張${theory.id}数学`,
      'computation':    `超${theory.id}計算`,
      'consciousness':  `反${theory.id}意識論`,
      'eastern-philosophy': `逆${theory.id}哲学`,
      'quantum':        `超${theory.id}量子論`,
    };

    return {
      name: systemNames[theory.category] ?? `${theory.id}-extension`,
      sourceAxiomId: theory.id,
      antiAxiomId: extendAnti.id,
      description: `${theory.id} を超える新体系の萌芽`,
      logicTag: 'ZERO',  // まだ潜在状態
      theories: [theory.id, extendAnti.id],
    };
  }
}
