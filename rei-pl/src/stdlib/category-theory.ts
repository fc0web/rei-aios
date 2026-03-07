/**
 * Rei-PL 標準ライブラリ — 圏論構文
 * Phase 6k: メタ公理層・根源層・圏論 統合
 *
 * 圏論のトークン8種:
 *   category, object, morphism, functor,
 *   natural_transform, compose, identity, limit
 */

/** 圏論トークン定義 */
export const CATEGORY_TOKENS = [
  'category', 'object', 'morphism', 'functor',
  'natural_transform', 'compose', 'identity', 'limit',
] as const;

export type CategoryToken = typeof CATEGORY_TOKENS[number];

/** Rei言語からエクスポートされる圏論構文定義 */
export const CATEGORY_STDLIB = `
-- Rei標準ライブラリ: 圏論 (category-theory.rei)
-- Theory #88: 圏論的論理統一理論

-- 圏の宣言
category LogicCategory {
  objects: [Logic7, Fuzzy, NValued, Catuskoti, Lukasiewicz]
  identity: forall A in objects -> id(A): A -> A
}

-- 関手の宣言: 四句分別 -> Logic7
functor CatuskotiToLogic7: Catuskoti -> Logic7 {
  map_object: catuskoti(x) -> normalize(catuskoti(x))
  map_morphism: f -> normalize . f
  preserves_identity: id(catuskoti(x)) -> id(normalize(x))
  preserves_composition: (f . g) -> (F(f) . F(g))
}

-- 自然変換: 全論理体系からLogic7への射影
natural_transform UniversalProjection {
  source: UniversalLogic
  target: Logic7
  component: forall L_n -> normalize(L_n)
  naturality: forall f: L_n -> L_m,
    normalize_m . F(f) == G(f) . normalize_n
}

-- 極限: 空図式 -> ZERO
limit EmptyDiagram: LogicCategory -> ZERO {
  terminal_object: ZERO
  unique_morphism: forall A in Logic7 -> exists_unique f: A -> ZERO
}

-- モナド: エフェクト系との接続
functor LogicMonad: Logic7 -> Logic7 {
  unit:    a -> FLOWING(a)
  flatten: FLOWING(FLOWING(a)) -> FLOWING(a)
}
`;

/** メタ公理のRei構文定義 */
export const META_AXIOM_STDLIB = `
-- Rei標準ライブラリ: メタ公理 (meta-axiom.rei)
-- Theory #89: メタ公理体系理論

meta_axiom Consistency {
  rule: forall phi in AxiomKernel -> not(proves(phi) and proves(not(phi)))
  verified: 3741_pairs_consistent
}

meta_axiom Independence {
  rule: forall phi in AxiomKernel ->
    not(provable(phi, AxiomKernel \\ {phi}))
}

meta_axiom Minimality {
  rule: forall K' subset AxiomKernel,
    if consistent(K') then prefer(K')
}

meta_axiom Completeness_Relative {
  rule: forall phi in Domain(AxiomKernel) ->
    provable(phi) or provable(not(phi))
  godel_limit: AxiomKernel not_proves Consistent(AxiomKernel)
}

meta_axiom SevenValued_Closure {
  rule: forall L_n -> exists pi: L_n -> Logic7
  category_form: exists natural_transform UniversalProjection
}
`;

/** 根源層ZEROのRei構文定義 */
export const ROOT_PRINCIPLE_STDLIB = `
-- Rei標準ライブラリ: 根源層 (root-principle.rei)
-- Theory #90: 円環根源論

root_principle ZERO {
  logic7_value: ZERO

  ontology: {
    buddhist:  "sunyata: 自性を持たない根源",
    taoist:    "Wuji: 太極以前の状態",
    vedanta:   "Nirguna Brahman: 属性なき絶対",
    goedel:    "公理系が自己言及できない外側",
    heidegger: "Sein: 存在そのもの"
  }

  circular: {
    generation:  ZERO -> AxiomKernel,
    reduction:   Implementation -> ZERO,
    identity:    ZERO -> ZERO,
    pratityasamutpada: forall x -> dependent_origin(x, ZERO)
  }

  ineffable: true
}
`;
