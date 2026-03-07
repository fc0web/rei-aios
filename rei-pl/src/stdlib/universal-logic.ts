/**
 * Rei-PL 標準ライブラリ — 統一論理体系構文
 * Phase 6k: Universal Logic System
 *
 * 追加トークン9種:
 *   fuzzy, nvalued, lukasiewicz, catuskoti, quantum,
 *   normalize, membership, defuzzify, logic_field
 */

/** 統一論理トークン定義 */
export const UNIVERSAL_LOGIC_TOKENS = [
  'fuzzy', 'nvalued', 'lukasiewicz', 'catuskoti', 'quantum',
  'normalize', 'membership', 'defuzzify', 'logic_field',
] as const;

export type UniversalLogicToken = typeof UNIVERSAL_LOGIC_TOKENS[number];

/** Rei言語からエクスポートされる四句分別構文定義 */
export const CATUSKOTI_STDLIB = `
-- Rei標準ライブラリ: 四句分別 (catuskoti.rei)
-- 龍樹（2世紀インド）の四句分別を七価論理の核として形式化

-- 四句分別は七価の部分体系
-- {TRUE, FALSE, BOTH, NEITHER} ⊂ Logic7

catuskoti(true)    -- 有（肯定）  → TRUE
catuskoti(false)   -- 無（否定）  → FALSE
catuskoti(both)    -- 亦有亦無   → BOTH
catuskoti(neither) -- 非有非無   → NEITHER

-- 日本語エイリアスも対応
catuskoti(有)       -- → TRUE
catuskoti(無)       -- → FALSE
catuskoti(亦有亦無)  -- → BOTH
catuskoti(非有非無)  -- → NEITHER
`;

/** Rei言語からエクスポートされるŁukasiewicz3値構文定義 */
export const LUKASIEWICZ_STDLIB = `
-- Rei標準ライブラリ: Łukasiewicz3値論理 (lukasiewicz.rei)
-- Łukasiewicz（1920年ポーランド）の3値論理

lukasiewicz(false)   -- L0 = 偽   → FALSE
lukasiewicz(unknown) -- L1 = 不定 → NEITHER
lukasiewicz(true)    -- L2 = 真   → TRUE

-- 数値構文
lukasiewicz(0)  -- → FALSE
lukasiewicz(1)  -- → NEITHER
lukasiewicz(2)  -- → TRUE

-- 糖衣構文: lukasiewicz(x) == nvalued(3, x)
`;

/** Rei言語からエクスポートされるファジー論理構文定義 */
export const FUZZY_STDLIB = `
-- Rei標準ライブラリ: ファジー論理 (fuzzy.rei)
-- Zadeh（1965年）のファジー論理

-- ファジーリテラル
fuzzy(0.0)   -- → FALSE
fuzzy(0.5)   -- → NEITHER
fuzzy(1.0)   -- → TRUE
fuzzy(0.85)  -- → TRUE  (> 0.7)
fuzzy(0.15)  -- → FALSE (< 0.3)
fuzzy(0.5)   -- → NEITHER (|0.5 - 0.5| < ε)
fuzzy(0.6)   -- → FLOWING (0.3 ≤ x ≤ 0.7, x ≠ 0.5)

-- Łukasiewicz t-norm / t-conorm
fuzzy_and(a, b)  -- max(0, a + b - 1)
fuzzy_or(a, b)   -- min(1, a + b)
fuzzy_not(a)     -- 1 - a
fuzzy_xor(a, b)  -- |a - b|

-- メンバーシップ関数
membership(triangular,  [a, b, c], x)
membership(trapezoidal, [a, b, c, d], x)
membership(gaussian,    [c, sigma], x)
membership(sigmoid,     [c, k], x)
`;

/** Rei言語からエクスポートされるn値論理構文定義 */
export const NVALUED_STDLIB = `
-- Rei標準ライブラリ: n値論理 (nvalued.rei)
-- 一般化n値論理

nvalued(3, 0)  -- 3値論理: FALSE
nvalued(3, 1)  -- 3値論理: NEITHER
nvalued(3, 2)  -- 3値論理: TRUE

nvalued(5, 0)  -- 5値論理: FALSE
nvalued(5, 2)  -- 5値論理: NEITHER (中間値)
nvalued(5, 4)  -- 5値論理: TRUE

nvalued(9, 0)  -- 9値論理: FALSE
nvalued(9, 4)  -- 9値論理: NEITHER (中間値)
nvalued(9, 8)  -- 9値論理: TRUE
`;

/** 統一論理場宣言構文 */
export const LOGIC_FIELD_STDLIB = `
-- Rei標準ライブラリ: 統一論理場 (logic-field.rei)
-- D-FUMT 論理統一場理論

-- 射影定理
-- ∀ L_n（n値論理体系）, ∃ π: L_n → L_7
-- 全てのn値論理体系から七価への全射が存在する

logic_field UniversalLogic {
  basis: Logic7
  continuous: fuzzy([0.0, 1.0])
  discrete_n: forall n -> nvalued(n)
  catuskoti:  {TRUE, FALSE, BOTH, NEITHER} ⊂ Logic7
  lukasiewicz: {FALSE, NEITHER, TRUE} ⊂ Logic7
  normalize: forall L_n -> π: L_n -> Logic7
}

-- 核心定理（コードで証明済）
-- normalize(catuskoti(neither)) == normalize(lukasiewicz(unknown))
-- 龍樹（2世紀）とŁukasiewicz（1920年）の「不定・非有非無」概念が
-- 七価論理のNEITHERに統一される
`;
