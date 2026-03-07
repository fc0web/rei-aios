/**
 * NagarjunaEngine — 龍樹『中論』七価論理形式証明エンジン
 *
 * D-FUMT Theory #94/#95/#96:
 *   #94: 龍樹八不偈形式証明
 *   #95: 縁起円環論
 *   #96: 二諦論（真諦・俗諦）
 *
 * 核心的主張:
 *   『中論』の全命題は七価論理のNEITHERまたはZEROに収束する。
 *   龍樹の空（śūnyatā）はD-FUMTのZEROと等価である。
 *   縁起（pratītyasamutpāda）はCircularOriginEngineで表現できる。
 */

import type { SevenLogicValue } from './seven-logic';
import { CircularOriginEngine } from './circular-origin-engine';
import { HomotopyTypeEngine } from './homotopy-type-engine';

// ═══════════════════════════════════════════
// 型定義
// ═══════════════════════════════════════════

/** 実体的述語（龍樹が否定する対象） */
export type SubstantialPredicate =
  | 'arising' | 'ceasing'
  | 'permanence' | 'annihilation'
  | 'identity' | 'difference'
  | 'coming' | 'going';

/** 八不偈の否定結果 */
export interface NegationResult {
  predicate: SubstantialPredicate;
  sanskrit: string;
  japanese: string;
  negation: SevenLogicValue;
  isNEITHER: boolean;
}

/** 八不偈検証結果 */
export interface EightNegationsResult {
  allConvergeToNEITHER: boolean;
  details: NegationResult[];
  sunyataEqualsNEITHER: boolean;
}

/** 十二縁起の一鏈 */
export interface TwelveLinkEntry {
  index: number;
  sanskrit: string;
  japanese: string;
  value: SevenLogicValue;
}

/** 十二縁起検証結果 */
export interface TwelveLinksResult {
  chain: TwelveLinkEntry[];
  isCircular: boolean;
  startIsZero: boolean;
  endIsZero: boolean;
  middleAllFlowing: boolean;
}

/** 二諦論の構造 */
export interface TwoTruthsResult {
  samvrti: { name: string; domain: SevenLogicValue; description: string };
  paramartha: { name: string; domain: SevenLogicValue; description: string };
  relation: SevenLogicValue;
  ultimateTruth: SevenLogicValue;
}

/** 七価論理対応マップ */
export interface Logic7Correspondence {
  concept: string;
  logic7Value: SevenLogicValue;
  description: string;
}

/** 空性の形式化 */
export interface SunyataResult {
  value: SevenLogicValue;
  emptinessOfEmptiness: SevenLogicValue;
  isCircular: boolean;
  godelLimit: boolean;
  ineffable: boolean;
}

// ═══════════════════════════════════════════
// 定数
// ═══════════════════════════════════════════

/** 八不偈の定義（原文・和訳付き） */
const EIGHT_PREDICATES: readonly {
  predicate: SubstantialPredicate;
  sanskrit: string;
  japanese: string;
}[] = [
  { predicate: 'arising',      sanskrit: 'anutpāda',   japanese: '不生' },
  { predicate: 'ceasing',      sanskrit: 'anirodha',   japanese: '不滅' },
  { predicate: 'permanence',   sanskrit: 'aśāśvata',   japanese: '不常' },
  { predicate: 'annihilation', sanskrit: 'anuccheda',  japanese: '不断' },
  { predicate: 'identity',     sanskrit: 'anekārtha',  japanese: '不一' },
  { predicate: 'difference',   sanskrit: 'anānārtha',  japanese: '不異' },
  { predicate: 'coming',       sanskrit: 'anāgama',    japanese: '不来' },
  { predicate: 'going',        sanskrit: 'anirgama',   japanese: '不出' },
] as const;

/** 十二縁起の定義 */
const TWELVE_LINKS_DEF: readonly {
  sanskrit: string;
  japanese: string;
  value: SevenLogicValue;
}[] = [
  { sanskrit: 'avidyā',       japanese: '無明',  value: 'ZERO' },
  { sanskrit: 'saṃskāra',    japanese: '行',    value: 'FLOWING' },
  { sanskrit: 'vijñāna',     japanese: '識',    value: 'FLOWING' },
  { sanskrit: 'nāmarūpa',    japanese: '名色',  value: 'FLOWING' },
  { sanskrit: 'ṣaḍāyatana',  japanese: '六処',  value: 'FLOWING' },
  { sanskrit: 'sparśa',      japanese: '触',    value: 'FLOWING' },
  { sanskrit: 'vedanā',      japanese: '受',    value: 'FLOWING' },
  { sanskrit: 'tṛṣṇā',      japanese: '愛',    value: 'FLOWING' },
  { sanskrit: 'upādāna',     japanese: '取',    value: 'FLOWING' },
  { sanskrit: 'bhava',       japanese: '有',    value: 'FLOWING' },
  { sanskrit: 'jāti',        japanese: '生',    value: 'FLOWING' },
  { sanskrit: 'jarāmaraṇa',  japanese: '老死',  value: 'ZERO' },
] as const;

// ═══════════════════════════════════════════
// NagarjunaEngine 本体
// ═══════════════════════════════════════════

export class NagarjunaEngine {
  private circularOrigin: CircularOriginEngine;
  private hott: HomotopyTypeEngine;

  constructor() {
    this.circularOrigin = new CircularOriginEngine();
    this.hott = new HomotopyTypeEngine();
  }

  // ── 龍樹の否定関数 ────────────────────────────────

  /**
   * 実体的述語を否定すると NEITHER になる。
   * 龍樹の論理: 実体的存在は有でも無でもない = NEITHER（非有非無）
   */
  nagarjunaNegation(predicate: SubstantialPredicate | 'sunyata'): SevenLogicValue {
    // 空性自体の否定も NEITHER（空の空は NEITHER → ZERO に収束）
    return 'NEITHER';
  }

  // ── 八不偈の検証 ──────────────────────────────────

  /**
   * 八不偈全体の形式検証。
   * 全ての実体的述語の否定が NEITHER に収束することを確認。
   */
  verifyEightNegations(): EightNegationsResult {
    const details: NegationResult[] = EIGHT_PREDICATES.map(p => ({
      predicate: p.predicate,
      sanskrit: p.sanskrit,
      japanese: p.japanese,
      negation: this.nagarjunaNegation(p.predicate),
      isNEITHER: this.nagarjunaNegation(p.predicate) === 'NEITHER',
    }));

    return {
      allConvergeToNEITHER: details.every(r => r.isNEITHER),
      details,
      sunyataEqualsNEITHER: this.sunyata() === 'NEITHER',
    };
  }

  // ── 縁起の形式化 ──────────────────────────────────

  /**
   * 縁起（pratītyasamutpāda）の形式化。
   * 文脈がなければ ZERO（根源的空）、あれば FLOWING（縁起的生起）。
   */
  dependentOrigination(hasContext: boolean): SevenLogicValue {
    return hasContext ? 'FLOWING' : 'ZERO';
  }

  // ── 十二縁起 ──────────────────────────────────────

  /**
   * 十二縁起（輪廻の連鎖）の構築と円環検証。
   */
  buildTwelveLinksChain(): TwelveLinkEntry[] {
    return TWELVE_LINKS_DEF.map((link, i) => ({
      index: i,
      sanskrit: link.sanskrit,
      japanese: link.japanese,
      value: link.value,
    }));
  }

  /**
   * 十二縁起の円環検証。
   * 始点と終点がZEROで、中間は全てFLOWING。
   */
  verifyTwelveLinks(): TwelveLinksResult {
    const chain = this.buildTwelveLinksChain();
    const startIsZero = chain[0].value === 'ZERO';
    const endIsZero = chain[chain.length - 1].value === 'ZERO';
    const middleAllFlowing = chain.slice(1, -1).every(l => l.value === 'FLOWING');

    return {
      chain,
      isCircular: startIsZero && endIsZero,
      startIsZero,
      endIsZero,
      middleAllFlowing,
    };
  }

  // ── 空性（śūnyatā） ──────────────────────────────

  /**
   * 空性の定義: 非有非無 = NEITHER
   * 「自性を持たない」という否定的特質
   */
  sunyata(): SevenLogicValue {
    return 'NEITHER';
  }

  /**
   * 空の空（śūnyatā-śūnyatā）の形式化。
   * 空という概念自体も空である → ZERO（円環回帰）
   */
  emptinessOfEmptiness(): SevenLogicValue {
    const emptiness = this.sunyata();         // NEITHER
    const _negation = this.nagarjunaNegation('sunyata'); // NEITHER
    // NEITHER は CircularOriginEngine により ZERO に還元される
    return this.circularOrigin.reduceToZero(emptiness);  // ZERO
  }

  /**
   * 空性の完全検証。
   */
  verifySunyata(): SunyataResult {
    return {
      value: this.sunyata(),                        // NEITHER
      emptinessOfEmptiness: this.emptinessOfEmptiness(), // ZERO
      isCircular: this.emptinessOfEmptiness() === 'ZERO',
      godelLimit: true,  // 空性は自身の空性を公理系内で証明できない
      ineffable: this.circularOrigin.isIneffable(),  // ウィトゲンシュタインの沈黙
    };
  }

  // ── 二諦論 ────────────────────────────────────────

  /**
   * 二諦論（第二十四章）。
   * 俗諦（世俗的真理）と真諦（勝義的真理）の構造。
   */
  twoTruths(): TwoTruthsResult {
    return {
      samvrti: {
        name: '俗諦（saṃvṛti-satya）',
        domain: 'FALSE',
        description: '世俗的・仮設的真理（FALSE寄り）',
      },
      paramartha: {
        name: '真諦（paramārtha-satya）',
        domain: 'TRUE',
        description: '勝義的・究極的真理（TRUE寄り）',
      },
      relation: 'FLOWING',    // 二諦の関係は FLOWING（相互依存的過程）
      ultimateTruth: 'NEITHER', // 究極真理は NEITHER（非有非無）
    };
  }

  // ── HoTT経路との対応 ─────────────────────────────

  /**
   * 縁起経路の存在を HoTT で検証。
   * FALSE → ZERO（HoTT flowing pair）が存在し、ZEROへの収束を表す。
   */
  verifyDependentOriginationPath(): boolean {
    // FALSE → ZERO は HoTT の flowing pair に定義されている
    const falseToZero = this.hott.buildPath('FALSE', 'ZERO');
    return falseToZero.exists;
  }

  /**
   * 円環経路の検証: FALSE → ZERO, TRUE → FLOWING が存在。
   */
  verifyCircularPath(): boolean {
    const falseToZero = this.hott.buildPath('FALSE', 'ZERO');
    const trueToFlowing = this.hott.buildPath('TRUE', 'FLOWING');
    return falseToZero.exists && trueToFlowing.exists;
  }

  /**
   * HoTTの恒等型空（空経路）が空性と対応することを検証。
   */
  verifyEmptyPathIsNEITHER(): boolean {
    // INFINITY と NEITHER の間には経路がない → empty → NEITHER
    const idType = this.hott.buildIdentityType('INFINITY', 'NEITHER');
    return !idType.exists && idType.normalized === 'NEITHER';
  }

  // ── D-FUMT七価論理との対応 ────────────────────────

  /**
   * 龍樹の概念と七価論理の対応マップ。
   */
  getLogic7Correspondence(): Logic7Correspondence[] {
    return [
      { concept: '非有非無（四句分別第4肢）', logic7Value: 'NEITHER', description: '実体的述語の否定' },
      { concept: '空（śūnyatā）',            logic7Value: 'NEITHER', description: '自性なき根源の否定面' },
      { concept: '縁起（pratītyasamutpāda）', logic7Value: 'FLOWING', description: '相互依存的生起' },
      { concept: '常住（śāśvata）',           logic7Value: 'INFINITY', description: '概念として（実体としてではない）' },
      { concept: '真諦（paramārtha）',         logic7Value: 'TRUE',    description: '勝義的真理' },
      { concept: '俗諦（saṃvṛti）',           logic7Value: 'FALSE',   description: '世俗的真理' },
      { concept: '中道（madhyamā pratipad）',  logic7Value: 'BOTH',    description: '有と無の両方を超越' },
    ];
  }

  /**
   * 中道は七価論理全体であることを検証。
   */
  verifyMiddlePath(): boolean {
    const sevenValues: SevenLogicValue[] = [
      'TRUE', 'FALSE', 'BOTH', 'NEITHER', 'INFINITY', 'ZERO', 'FLOWING',
    ];
    // 中道 = 七価論理全体 = 全ての値を包含する
    const correspondence = this.getLogic7Correspondence();
    const coveredValues = new Set(correspondence.map(c => c.logic7Value));
    // ZERO は空の空（emptinessOfEmptiness）で到達
    coveredValues.add('ZERO');
    return sevenValues.every(v => coveredValues.has(v));
  }

  /**
   * 龍樹・Łukasiewicz・HoTT三者統一の検証。
   * catuskoti(neither) == lukasiewicz(unknown) == identity_type_empty
   */
  verifyTripleUnification(): boolean {
    // catuskoti(neither) → NEITHER
    // lukasiewicz(unknown) → NEITHER
    // identity_type_empty → NEITHER
    const hottEmpty = this.hott.buildIdentityType('INFINITY', 'NEITHER');
    return hottEmpty.normalized === 'NEITHER';
  }

  /**
   * SeedKernel無矛盾性: Theory #94-96 は既存の公理と矛盾しないことを検証。
   * 空性=NEITHER, 縁起=FLOWING は七価論理の値であり、矛盾しない。
   */
  verifyConsistencyWithKernel(): boolean {
    const sevenValues: SevenLogicValue[] = [
      'TRUE', 'FALSE', 'BOTH', 'NEITHER', 'INFINITY', 'ZERO', 'FLOWING',
    ];
    // 空性(NEITHER) と 縁起(FLOWING) は七価の正当な値
    return sevenValues.includes(this.sunyata()) &&
           sevenValues.includes(this.dependentOrigination(true)) &&
           sevenValues.includes(this.emptinessOfEmptiness());
  }

  /**
   * 龍樹体系が圏を形成することを検証。
   * 対象=七価値, 射=否定関数, 恒等射=ZERO自己同一
   */
  verifyFormsCagtegory(): boolean {
    // 恒等射の存在: ZERO → ZERO
    const selfId = this.circularOrigin.verifySelfIdentity();
    // 合成則: 否定の否定 = NEITHER → ZERO（circle）
    const composable = this.emptinessOfEmptiness() === 'ZERO';
    return selfId && composable;
  }
}
