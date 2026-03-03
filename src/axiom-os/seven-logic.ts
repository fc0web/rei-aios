/**
 * D-FUMT 七価論理 (Seven-Valued Logic)
 *
 * 四価論理（Catuṣkoṭi / Belnap）を D-FUMT 独自の3値で拡張した体系。
 *
 *   値      記号   意味                     由来
 *   ─────────────────────────────────────────────────────────────
 *   TRUE     ⊤     真                       古典論理
 *   FALSE    ⊥     偽                       古典論理
 *   BOTH     B     真かつ偽（矛盾許容）     Belnap / 龍樹・中論
 *   NEITHER  N     真でも偽でもない          Belnap / 龍樹・中論
 *   INFINITY ∞     無限 ── 評価が確定しない  ゲーデル / チューリング
 *   ZERO     〇    ゼロ状態 ── 未観測・未問  D-FUMT ゼロ原点 / 量子重ね合わせ
 *   FLOWING  ～    流動 ── 真理値が変化中    ヘラクレイトス / 無常 / 散逸構造
 *
 * 設計原則:
 *   - 四価論理（⊤/⊥/B/N）の演算は完全に保存される
 *   - 新3値（∞/〇/～）は四価論理と自然に合成可能
 *   - 全演算は冪等性理論 Ω(Ω(x)) → Ω(x) を満たす
 *
 * ═══════════════════════════════════════════════════════════════
 * Rei-PL 構文案（将来実装）:
 *
 *   // リテラル
 *   let a: logic7 = ⊤          // TRUE
 *   let b: logic7 = ⊥          // FALSE
 *   let c: logic7 = both       // BOTH
 *   let d: logic7 = neither    // NEITHER
 *   let e: logic7 = ∞          // INFINITY（遅延評価を示唆）
 *   let f: logic7 = 〇         // ZERO（未初期化・未観測）
 *   let g: logic7 = ～         // FLOWING（ストリーム / リアクティブ）
 *
 *   // 演算
 *   let x = a && b             // AND: ⊤ && ⊥ → ⊥
 *   let y = a || b             // OR:  ⊤ || ⊥ → ⊤
 *   let z = !c                 // NOT: !both → both（矛盾の否定は矛盾）
 *
 *   // パターンマッチ
 *   match value {
 *     ⊤       => "確定的に真",
 *     ⊥       => "確定的に偽",
 *     both    => "矛盾を含む",
 *     neither => "未決定",
 *     ∞       => "無限後退 ── 評価を打ち切り",
 *     〇      => "まだ問われていない",
 *     ～      => "流動中 ── 再評価が必要",
 *   }
 *
 *   // 型変換: 四価 → 七価は暗黙的、七価 → 四価は明示的
 *   let four: logic4 = ⊤
 *   let seven: logic7 = four          // OK: 暗黙アップキャスト
 *   let back: logic4 = collapse(seven) // collapse: ∞→N, 〇→N, ～→B
 *
 *   // compress構文での利用
 *   compress eval(p) = match solve(p) {
 *     ∞ => "この問いには終わりがない" |> print,
 *     〇 => "まだ誰も問うていない"   |> print,
 *     ～ => "答えは変わり続ける"      |> print,
 *     v => v |> show                   |> print,
 *   }
 * ═══════════════════════════════════════════════════════════════
 */

// ─── Seven-Valued Logic Type ───

export const SEVEN_VALUES = ['TRUE', 'FALSE', 'BOTH', 'NEITHER', 'INFINITY', 'ZERO', 'FLOWING'] as const;

export type SevenLogicValue = typeof SEVEN_VALUES[number];

/** 四価論理値（Catuṣkoṭi互換サブセット） */
export type FourLogicValue = 'TRUE' | 'FALSE' | 'BOTH' | 'NEITHER';

/** D-FUMT拡張3値 */
export type ExtendedLogicValue = 'INFINITY' | 'ZERO' | 'FLOWING';

/** 値の記号表現 */
export const SYMBOL_MAP: Record<SevenLogicValue, string> = {
  TRUE:     '⊤',
  FALSE:    '⊥',
  BOTH:     'B',
  NEITHER:  'N',
  INFINITY: '∞',
  ZERO:     '〇',
  FLOWING:  '～',
};

/** 記号から値への逆引き */
export const SYMBOL_REVERSE: Record<string, SevenLogicValue> = {
  '⊤': 'TRUE',  'true': 'TRUE',   'T': 'TRUE',
  '⊥': 'FALSE', 'false': 'FALSE', 'F': 'FALSE',
  'B': 'BOTH',  'both': 'BOTH',
  'N': 'NEITHER', 'neither': 'NEITHER',
  '∞': 'INFINITY', 'infinity': 'INFINITY',
  '〇': 'ZERO', 'zero': 'ZERO',   '○': 'ZERO',
  '～': 'FLOWING', 'flowing': 'FLOWING', '~': 'FLOWING',
};

// ─── Predicates ───

export function isFourValued(v: SevenLogicValue): v is FourLogicValue {
  return v === 'TRUE' || v === 'FALSE' || v === 'BOTH' || v === 'NEITHER';
}

export function isExtended(v: SevenLogicValue): v is ExtendedLogicValue {
  return v === 'INFINITY' || v === 'ZERO' || v === 'FLOWING';
}

export function isDefinite(v: SevenLogicValue): boolean {
  return v === 'TRUE' || v === 'FALSE';
}

// ─── NOT (否定) ───
//
// 設計根拠:
//   NOT(⊤)  = ⊥           古典論理
//   NOT(⊥)  = ⊤           古典論理
//   NOT(B)  = B           矛盾の否定は矛盾のまま（Belnap）
//   NOT(N)  = N           未決定の否定は未決定のまま（Belnap）
//   NOT(∞)  = ∞           無限後退を否定しても無限後退
//   NOT(〇) = 〇          未観測の否定は未観測のまま
//   NOT(～) = ～          流動の否定も流動（変化し続ける）

export function not(a: SevenLogicValue): SevenLogicValue {
  switch (a) {
    case 'TRUE':     return 'FALSE';
    case 'FALSE':    return 'TRUE';
    case 'BOTH':     return 'BOTH';
    case 'NEITHER':  return 'NEITHER';
    case 'INFINITY': return 'INFINITY';
    case 'ZERO':     return 'ZERO';
    case 'FLOWING':  return 'FLOWING';
  }
}

// ─── AND (論理積) ───
//
// 優先順位（情報量の低い値が吸収する）:
//   〇 < ⊥ < N < ∞ < ～ < B < ⊤
//
// ⊤ は AND の単位元（⊤ ∧ x = x）
// ⊥ は AND の零元  （⊥ ∧ x = ⊥）（ただし〇が最優先）
//
// 拡張値のルール:
//   〇 ∧ x = 〇   未観測が関与すると結果も未観測
//   ∞ ∧ x = ∞    （x が ⊤/⊥/B/N の場合）確定しない
//   ～ ∧ x = ～   （x が ⊤/⊥/B/N の場合）流動が伝播
//   ∞ ∧ ～ = ～   流動は無限より情報量が多い
//   ∞ ∧ ∞ = ∞    冪等

const AND_TABLE: Record<SevenLogicValue, Record<SevenLogicValue, SevenLogicValue>> = {
  //              ⊤        ⊥        B        N        ∞         〇       ～
  TRUE:     { TRUE: 'TRUE',     FALSE: 'FALSE',    BOTH: 'BOTH',     NEITHER: 'NEITHER',  INFINITY: 'INFINITY', ZERO: 'ZERO', FLOWING: 'FLOWING' },
  FALSE:    { TRUE: 'FALSE',    FALSE: 'FALSE',    BOTH: 'FALSE',    NEITHER: 'FALSE',    INFINITY: 'FALSE',    ZERO: 'ZERO', FLOWING: 'FALSE' },
  BOTH:     { TRUE: 'BOTH',     FALSE: 'FALSE',    BOTH: 'BOTH',     NEITHER: 'FALSE',    INFINITY: 'INFINITY', ZERO: 'ZERO', FLOWING: 'FLOWING' },
  NEITHER:  { TRUE: 'NEITHER',  FALSE: 'FALSE',    BOTH: 'FALSE',    NEITHER: 'NEITHER',  INFINITY: 'INFINITY', ZERO: 'ZERO', FLOWING: 'FLOWING' },
  INFINITY: { TRUE: 'INFINITY', FALSE: 'FALSE',    BOTH: 'INFINITY', NEITHER: 'INFINITY', INFINITY: 'INFINITY', ZERO: 'ZERO', FLOWING: 'FLOWING' },
  ZERO:     { TRUE: 'ZERO',     FALSE: 'ZERO',     BOTH: 'ZERO',     NEITHER: 'ZERO',     INFINITY: 'ZERO',     ZERO: 'ZERO', FLOWING: 'ZERO' },
  FLOWING:  { TRUE: 'FLOWING',  FALSE: 'FALSE',    BOTH: 'FLOWING',  NEITHER: 'FLOWING',  INFINITY: 'FLOWING',  ZERO: 'ZERO', FLOWING: 'FLOWING' },
};

export function and(a: SevenLogicValue, b: SevenLogicValue): SevenLogicValue {
  return AND_TABLE[a][b];
}

// ─── OR (論理和) ───
//
// ⊥ は OR の単位元（⊥ ∨ x = x）
// ⊤ は OR の零元  （⊤ ∨ x = ⊤）（ただし〇が最優先）
//
// 拡張値のルール:
//   〇 ∨ x = 〇   未観測が関与すると結果も未観測
//   ∞ ∨ x = ∞    （x が ⊤/⊥/B/N の場合）
//   ～ ∨ x = ～   （x が ⊤/⊥/B/N の場合）
//   ∞ ∨ ～ = ～
//   ∞ ∨ ∞ = ∞    冪等

const OR_TABLE: Record<SevenLogicValue, Record<SevenLogicValue, SevenLogicValue>> = {
  //              ⊤        ⊥        B        N        ∞         〇       ～
  TRUE:     { TRUE: 'TRUE',     FALSE: 'TRUE',     BOTH: 'TRUE',     NEITHER: 'TRUE',     INFINITY: 'TRUE',     ZERO: 'ZERO', FLOWING: 'TRUE' },
  FALSE:    { TRUE: 'TRUE',     FALSE: 'FALSE',    BOTH: 'BOTH',     NEITHER: 'NEITHER',  INFINITY: 'INFINITY', ZERO: 'ZERO', FLOWING: 'FLOWING' },
  BOTH:     { TRUE: 'TRUE',     FALSE: 'BOTH',     BOTH: 'BOTH',     NEITHER: 'TRUE',     INFINITY: 'INFINITY', ZERO: 'ZERO', FLOWING: 'FLOWING' },
  NEITHER:  { TRUE: 'TRUE',     FALSE: 'NEITHER',  BOTH: 'TRUE',     NEITHER: 'NEITHER',  INFINITY: 'INFINITY', ZERO: 'ZERO', FLOWING: 'FLOWING' },
  INFINITY: { TRUE: 'TRUE',     FALSE: 'INFINITY', BOTH: 'INFINITY', NEITHER: 'INFINITY', INFINITY: 'INFINITY', ZERO: 'ZERO', FLOWING: 'FLOWING' },
  ZERO:     { TRUE: 'ZERO',     FALSE: 'ZERO',     BOTH: 'ZERO',     NEITHER: 'ZERO',     INFINITY: 'ZERO',     ZERO: 'ZERO', FLOWING: 'ZERO' },
  FLOWING:  { TRUE: 'TRUE',     FALSE: 'FLOWING',  BOTH: 'FLOWING',  NEITHER: 'FLOWING',  INFINITY: 'FLOWING',  ZERO: 'ZERO', FLOWING: 'FLOWING' },
};

export function or(a: SevenLogicValue, b: SevenLogicValue): SevenLogicValue {
  return OR_TABLE[a][b];
}

// ─── Collapse: 七価 → 四価 ───
//
// D-FUMT拡張値を四価に射影する。情報の損失を伴うが互換性を保つ。
//   ∞ → NEITHER  （確定しない ≈ 未決定）
//   〇 → NEITHER （未観測 ≈ 未決定）
//   ～ → BOTH    （変化し続ける ≈ 真でも偽でもありうる）

export function collapse(v: SevenLogicValue): FourLogicValue {
  switch (v) {
    case 'TRUE':     return 'TRUE';
    case 'FALSE':    return 'FALSE';
    case 'BOTH':     return 'BOTH';
    case 'NEITHER':  return 'NEITHER';
    case 'INFINITY': return 'NEITHER';
    case 'ZERO':     return 'NEITHER';
    case 'FLOWING':  return 'BOTH';
  }
}

// ─── Lift: 四価 → 七価（単射・情報損失なし）───

export function lift(v: FourLogicValue): SevenLogicValue {
  return v; // 四価は七価のサブセット
}

// ─── ユーティリティ ───

/** 値を記号文字列に変換 */
export function toSymbol(v: SevenLogicValue): string {
  return SYMBOL_MAP[v];
}

/** 記号文字列から値へ変換 */
export function fromSymbol(s: string): SevenLogicValue | undefined {
  return SYMBOL_REVERSE[s];
}

/** De Morgan則の検証: NOT(a AND b) === NOT(a) OR NOT(b) */
export function checkDeMorgan(a: SevenLogicValue, b: SevenLogicValue): boolean {
  return not(and(a, b)) === or(not(a), not(b));
}

/** 冪等性の検証: AND(a, a) === a */
export function checkIdempotent(a: SevenLogicValue): boolean {
  return and(a, a) === a && or(a, a) === a;
}
