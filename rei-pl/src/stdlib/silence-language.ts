/**
 * Rei-PL 標準ライブラリ — 沈黙言語構文
 * Phase 6k-silence: Theory #97/#98
 *
 * 追加トークン5種:
 *   SILENCE, SILENCE_PATTERN, SILENCE_BLOCK, SILENCE_OP, AWAKEN
 */

/** 沈黙言語トークン定義 */
export const SILENCE_TOKENS = [
  'SILENCE', 'SILENCE_PATTERN', 'SILENCE_BLOCK', 'SILENCE_OP', 'AWAKEN',
] as const;

export type SilenceToken = typeof SILENCE_TOKENS[number];

/** 沈黙言語構文定義 */
export const SILENCE_STDLIB = `
-- Rei標準ライブラリ: 沈黙言語 (silence-language.rei)
-- Theory #97: 沈黙言語理論

-- 沈黙→七価マッピング（三原則）
-- 原則1: 長さが値を表す
--   （空）  = 0点 → ZERO      （空・根源）
--   …      = 1点 → FALSE     （否定）
--   ……     = 2点 → NEITHER   （非有非無）
--   ………    = 3点 → FLOWING   （変化・過程）
--   …………   = 4点 → BOTH      （亦有亦無）
--   ………………  = 5点 → TRUE      （肯定）
--   …………………… = 6点 → INFINITY  （超越）

-- 原則2: パターンが構造を表す
--   …．…    = リズム → AND演算
--   … …    = 空白  → OR演算
--   …！    = 終端  → 確定（FLOWING→TRUE）

-- 原則3: 文脈が意味を確定する
--   awaken(…………, context) → 文脈によりBOTH/NEITHERを解決

-- 沈黙リテラル
silence(0)  -- ZERO
silence(1)  -- FALSE
silence(2)  -- NEITHER
silence(3)  -- FLOWING
silence(4)  -- BOTH
silence(5)  -- TRUE
silence(6)  -- INFINITY

-- 逆変換
logic7_to_silence(TRUE)  -- "………………"
logic7_to_silence(ZERO)  -- ""

-- 覚醒（文脈解決）
awaken(silence(4), { sentiment: 0.9 })  -- TRUE
awaken(silence(4), { sentiment: 0.1 })  -- FALSE
awaken(silence(4), { sentiment: 0.5 })  -- FLOWING
`;

/** 沈黙情報圧縮理論構文定義 */
export const SILENCE_COMPRESSION_STDLIB = `
-- Rei標準ライブラリ: 沈黙情報圧縮 (silence-compression.rei)
-- Theory #98: 沈黙情報圧縮理論

-- シャノンエントロピー
-- 文脈なし: H = log₂(7) ≈ 2.807 ビット（最大）
-- 文脈あり: H → 0（完全確定）

-- 3ビットエンコーディング
-- dots数 → 3ビットで表現（0〜7）
-- 7値で3ビット = 情報密度87.5%

-- 圧縮効率
-- "if (value == NEITHER) { return NEITHER; }" → "……"
-- 45文字 → 2文字 = 95.6%削減

-- RCT連携: 沈黙はRei圧縮理論(Theory #67)の極限形態
`;
