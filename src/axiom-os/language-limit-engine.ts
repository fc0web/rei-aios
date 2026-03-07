/**
 * Rei-AIOS STEP 25 — LanguageLimitEngine
 * ウィトゲンシュタイン的言語限界の形式エンジン
 *
 * Theory #158〜#165 の操作的実装。
 * 「この命題は語りえるか？」を七価論理で判定する。
 */

import type { DFUMTValue } from '../memory/aios-memory';
import { SevenValueClassifier } from '../logic/seven-value-classifier';

// ─── 型定義 ──────────────────────────────────────────────────

export type SayabilityResult =
  | 'SAYABLE'        // 語りえる（TRUE/FALSEに還元可能）
  | 'SHOWABLE'       // 示せるが語れない（NEITHER）
  | 'UNSPEAKABLE'    // 語りえない（ZERO・沈黙の命令）
  | 'GAME_DEPENDENT' // 言語ゲーム依存（FLOWING）
  | 'FAMILY'         // 家族的類似（BOTH・境界なし）
  | 'PARADOXICAL';   // 規則パラドックス（BOTH・クリプキ）

export interface LanguageAnalysis {
  proposition:    string;
  sayability:     SayabilityResult;
  dfumtValue:     DFUMTValue;
  theory:         string;    // 適用されたTheory ID
  explanation:    string;    // なぜその判定か
  silenceNeeded:  boolean;   // 沈黙すべきか
}

// ─── 語りえるかの判定パターン ─────────────────────────────

interface SayabilityRule {
  pattern:    RegExp;
  result:     SayabilityResult;
  dfumt:      DFUMTValue;
  theoryId:   string;
  explain:    string;
  silence:    boolean;
}

const SAYABILITY_RULES: SayabilityRule[] = [
  // ── UNSPEAKABLE（ZERO）: 倫理・美・神秘 ──────────────────
  {
    pattern:  /なぜ生きるか|人生の意味|神は|死後|魂|絶対的な善|美しさとは何か/i,
    result:   'UNSPEAKABLE',
    dfumt:    'ZERO',
    theoryId: 'dfumt-silence-command',
    explain:  'Tractatus 7: 語りえぬものについては沈黙しなければならない。この問いは言語の外側にある。',
    silence:  true,
  },
  // ── SHOWABLE（NEITHER）: 示せるが語れない ─────────────────
  {
    pattern:  /感じ|クオリア|痛みとは|赤い|意識の内側|経験そのもの/i,
    result:   'SHOWABLE',
    dfumt:    'NEITHER',
    theoryId: 'dfumt-private-language',
    explain:  '私的言語論: 内的経験は共有も否定もできない。示すことはできるが語ることはできない（NEITHER）。',
    silence:  false,
  },
  {
    pattern:  /論理の形式|倫理的なもの|美的なもの|言語の構造そのもの/i,
    result:   'SHOWABLE',
    dfumt:    'NEITHER',
    theoryId: 'dfumt-showing-saying',
    explain:  'Tractatus 4.1212: 示せるが語れない。ZEROより豊かな沈黙（NEITHER）。',
    silence:  false,
  },
  // ── GAME_DEPENDENT（FLOWING）: 言語ゲーム依存 ────────────
  {
    pattern:  /文脈によって|場合による|どんな意味で|使い方次第|ゲームの中で/i,
    result:   'GAME_DEPENDENT',
    dfumt:    'FLOWING',
    theoryId: 'dfumt-language-game',
    explain:  '言語ゲーム論: 意味は使用によって決まる（FLOWING）。文脈が変われば意味も変わる。',
    silence:  false,
  },
  // ── FAMILY（BOTH）: 家族的類似 ───────────────────────────
  {
    pattern:  /本質とは何か|定義して|共通するもの|ゲームとは|芸術とは/i,
    result:   'FAMILY',
    dfumt:    'BOTH',
    theoryId: 'dfumt-family-resemblance',
    explain:  '家族的類似: この概念に明確な境界はない（BOTH）。複数の特徴が重なり合うだけ。',
    silence:  false,
  },
  // ── PARADOXICAL（BOTH）: 規則パラドックス ────────────────
  {
    pattern:  /規則に従う|正しい解釈|規則とは|ルールの意味/i,
    result:   'PARADOXICAL',
    dfumt:    'BOTH',
    theoryId: 'dfumt-rule-following',
    explain:  'クリプキのパラドックス: どんな解釈も規則と「一致」させられる（BOTH）。唯一の正しい解釈は存在しない。',
    silence:  false,
  },
];

// ─── LanguageLimitEngine 本体 ────────────────────────────────

export class LanguageLimitEngine {
  private clf: SevenValueClassifier;

  constructor() {
    this.clf = new SevenValueClassifier();
  }

  /**
   * 命題・問いが「語りえるか」を判定する（Theory #158〜#165）
   */
  analyze(proposition: string): LanguageAnalysis {
    // ── 1. パターンマッチング ──────────────────────────────
    for (const rule of SAYABILITY_RULES) {
      if (rule.pattern.test(proposition)) {
        return {
          proposition,
          sayability:   rule.result,
          dfumtValue:   rule.dfumt,
          theory:       rule.theoryId,
          explanation:  rule.explain,
          silenceNeeded: rule.silence,
        };
      }
    }

    // ── 2. SevenValueClassifier で補完 ────────────────────
    const classified = this.clf.classify(proposition);

    if (classified.value === 'NEITHER') {
      return {
        proposition,
        sayability:   'SHOWABLE',
        dfumtValue:   'NEITHER',
        theory:       'dfumt-showing-saying',
        explanation:  '示せるが語れない領域（NEITHER）。示すことで伝わる。',
        silenceNeeded: false,
      };
    }

    if (classified.value === 'ZERO') {
      return {
        proposition,
        sayability:   'UNSPEAKABLE',
        dfumtValue:   'ZERO',
        theory:       'dfumt-silence-command',
        explanation:  '語りえない（ZERO）。沈黙が誠実な応答。',
        silenceNeeded: true,
      };
    }

    // ── 3. 語りえる（写像理論） ───────────────────────────
    return {
      proposition,
      sayability:   'SAYABLE',
      dfumtValue:   classified.value,
      theory:       'dfumt-tractatus-picture',
      explanation:  `この命題は世界の像として語りえる（${classified.value}）。`,
      silenceNeeded: false,
    };
  }

  /**
   * 複数命題をバッチ分析
   */
  analyzeBatch(propositions: string[]): LanguageAnalysis[] {
    return propositions.map(p => this.analyze(p));
  }

  /**
   * 「語りえない」領域の境界を示す
   * NEITHERとZEROの違いを明示する（Theory #163の核心）
   */
  static explainBoundary(): string {
    return `
【言語の限界における三つの領域】

ZERO（絶対的沈黙）:
  語りえず、示すこともできない。
  問い自体がナンセンス（Unsinn）。
  例: 「なぜ何かが存在するのか」「神は善か」

NEITHER（豊かな沈黙）:
  語れないが、示すことはできる。
  沈黙より豊かで、語るより正直。
  例: 痛みの感覚・美の体験・倫理的直観

FLOWING（言語ゲーム）:
  意味は固定されず文脈で変化する。
  語れるが「どの言語ゲームで？」が常に問われる。
  例: 「ゲーム」「愛」「正義」

TRUE/FALSE（写像可能）:
  命題が世界の像として検証可能。
  例: 「2+2=4」「水は100度で沸騰する」`.trim();
  }

  /**
   * D-FUMTとウィトゲンシュタインの統合ポイントを返す
   */
  static getIntegrationPoints(): Array<{ wittgenstein: string; dfumt: string; value: DFUMTValue }> {
    return [
      {
        wittgenstein: '語りえぬものについては沈黙しなければならない（Tractatus 7）',
        dfumt:        'ZERO = 未問の潜在真理・絶対的沈黙',
        value:        'ZERO',
      },
      {
        wittgenstein: '示すこと（zeigen）は語ること（sagen）の外側にある',
        dfumt:        'NEITHER = 真でも偽でもない・龍樹的空性との接続',
        value:        'NEITHER',
      },
      {
        wittgenstein: '言語ゲームにおいて意味は使用によって決まる',
        dfumt:        'FLOWING = 時間とともに変化する真理値・縁起との接続',
        value:        'FLOWING',
      },
      {
        wittgenstein: '家族的類似：概念に明確な境界はない',
        dfumt:        'BOTH = 真でも偽でもある・重ね合わせ状態',
        value:        'BOTH',
      },
      {
        wittgenstein: '私の言語の限界は私の世界の限界を意味する（Tractatus 5.6）',
        dfumt:        'INFINITY = 限界は螺旋的に後退し続ける・無限展開',
        value:        'INFINITY',
      },
    ];
  }
}
