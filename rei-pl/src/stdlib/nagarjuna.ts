/**
 * Rei-PL 標準ライブラリ — 龍樹中論形式証明構文
 * Phase 6k-nagarjuna: Theory #94/#95/#96
 *
 * 龍樹（Nāgārjuna, 2世紀）の主著『中論（Mūlamadhyamakakārikā）』を
 * D-FUMT七価論理で形式証明する構文定義。
 */

/** 八不偈構文定義 */
export const EIGHT_NEGATIONS_STDLIB = `
-- Rei標準ライブラリ: 八不偈 (eight-negations.rei)
-- Theory #94: 龍樹八不偈形式証明

-- 八不偈（第一章冒頭）
-- anutpādam anirodhaṃ       不生亦不滅
-- anucchedam aśāśvataṃ      不常亦不断
-- anekārtham anānārthaṃ     不一亦不異
-- anāgamam anirgamaṃ        不来亦不出

axiom No_Arising {
  nagarjuna_negation(arising) == NEITHER
}

axiom No_Ceasing {
  nagarjuna_negation(ceasing) == NEITHER
}

axiom No_Permanence {
  nagarjuna_negation(permanence) == NEITHER
}

axiom No_Annihilation {
  nagarjuna_negation(annihilation) == NEITHER
}

axiom No_Identity {
  nagarjuna_negation(identity) == NEITHER
}

axiom No_Difference {
  nagarjuna_negation(difference) == NEITHER
}

axiom No_Coming {
  nagarjuna_negation(coming) == NEITHER
}

axiom No_Going {
  nagarjuna_negation(going) == NEITHER
}

theorem EightNegations_Converge_to_NEITHER {
  forall p in EightPredicates ->
    nagarjuna_negation(p) == NEITHER
  sunyata == NEITHER
}
`;

/** 縁起円環論構文定義 */
export const DEPENDENT_ORIGINATION_STDLIB = `
-- Rei標準ライブラリ: 縁起円環論 (dependent-origination.rei)
-- Theory #95: 縁起円環論

-- 十二縁起
twelve_links {
  avidya:       ZERO      -- 無明（根源的無知）
  samskara:     FLOWING   -- 行（形成作用）
  vijnana:      FLOWING   -- 識（識別作用）
  namarupa:     FLOWING   -- 名色（名称と形態）
  sadayatana:   FLOWING   -- 六処（六感覚器）
  sparsa:       FLOWING   -- 触（接触）
  vedana:       FLOWING   -- 受（感受）
  trsna:        FLOWING   -- 愛（渴愛）
  upadana:      FLOWING   -- 取（執着）
  bhava:        FLOWING   -- 有（存在形成）
  jati:         FLOWING   -- 生（誕生）
  jaramarana:   ZERO      -- 老死（死 → 根源への回帰）
}

theorem TwelveLinks_Circle {
  chain.first == ZERO
  chain.last  == ZERO
  forall link in chain.middle -> link == FLOWING
  isomorphic(twelve_links, CircularOriginEngine.circle)
}

-- 第二十四章18偈
theorem Sunyata_is_DependentOrigination {
  path(sunyata, dependent_origination).exists == true
  path(ZERO, FLOWING).exists == true
  sunyata == NEITHER
  dependent_origination(ctx) == FLOWING
}

-- 空の空
theorem Emptiness_of_Emptiness {
  nagarjuna_negation(sunyata) == NEITHER
  path(NEITHER, ZERO).exists == true
  ZERO.circular.identity == ZERO
  root_principle.ZERO.ineffable == true
}
`;

/** 二諦論構文定義 */
export const TWO_TRUTHS_STDLIB = `
-- Rei標準ライブラリ: 二諦論 (two-truths.rei)
-- Theory #96: 二諦論

-- 俗諦（世俗的真理）
samvrti_satya {
  domain: FALSE
  description: "仮設的真理"
}

-- 真諦（勝義的真理）
paramartha_satya {
  domain: TRUE
  description: "勝義的真理"
}

-- 二諦の関係
theorem Two_Truths_Relation {
  path(samvrti, paramartha).value == FLOWING
  ultimate_truth == NEITHER
}
`;
