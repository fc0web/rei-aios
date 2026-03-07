/**
 * Rei-PL 標準ライブラリ — ∞圏論・HoTT構文
 * Phase 6k-HoTT: ∞圏論・ホモトピー型理論 統合
 *
 * HoTT・∞圏論トークン10種:
 *   inf_category, n_morphism, higher_path, homotopy,
 *   identity_type, univalence, universe, fiber,
 *   path_induction, truncation
 */

/** HoTT・∞圏論トークン定義 */
export const HOTT_TOKENS = [
  'inf_category', 'n_morphism', 'higher_path', 'homotopy',
  'identity_type', 'univalence', 'universe', 'fiber',
  'path_induction', 'truncation',
] as const;

export type HoTTToken = typeof HOTT_TOKENS[number];

/** Rei言語からエクスポートされる∞圏論構文定義 */
export const INF_CATEGORY_STDLIB = `
-- Rei標準ライブラリ: ∞圏論 (inf-category.rei)
-- Theory #91: ∞圏論的宇宙論

inf_category LogicInfCategory {
  objects:     Logic7
  morphisms_1: UniversalLogic -> Logic7
  morphisms_2: Functor -> Functor
  morphisms_n: forall n -> n_morphism(n)
  limit_inf:   ZERO
}

n_morphism(1) NormalizeProjection: UniversalLogic -> Logic7 {
  map: v -> normalize(v)
}

n_morphism(2) ProjectionTransform:
    NormalizeProjection => IdentityLogic7 {
  component: forall v -> normalize(normalize(v)) == normalize(v)
}

n_morphism(3) CoherenceModification:
    ProjectionTransform => ProjectionTransform {
  coherent: true
}

n_morphism(inf) ConvergenceToZero: forall n -> ZERO {
  limit: lim(n -> inf) n_morphism(n) == ZERO
}
`;

/** Rei言語からエクスポートされるHoTT構文定義 */
export const HOTT_STDLIB = `
-- Rei標準ライブラリ: HoTT (homotopy-type-theory.rei)
-- Theory #92: ホモトピー型理論的論理

identity_type Logic7Equality {
  refl_true:       TRUE  =_{Logic7} TRUE
  both_path:       TRUE  =_{Logic7} FALSE
  neither_empty:   not(exists path(TRUE, FALSE))
  flowing_homotopy: exists homotopy(p, q)
}

path TrueToFlowing: TRUE -> FLOWING {
  homotopy: t -> fuzzy(1.0 - 0.4 * t)
}

higher_path PathBetweenPaths:
    TrueToFlowing =_{Path} AnotherPath {
  witness: exists H: [0,1] x [0,1] -> Logic7
}

univalence UnivalenceAxiom {
  statement: forall A B: Universe ->
    (A ~ B) ~ (A =_{Universe} B)
  application: forall L_n L_m ->
    if (L_n ~ L_m) then (L_n = L_m)
}
`;

/** Rei言語からエクスポートされる切り詰め構文定義 */
export const TRUNCATION_STDLIB = `
-- Rei標準ライブラリ: 切り詰め階層 (truncation.rei)
-- Theory #93: 切り詰め階層理論

truncation(0) PropositionalLogic {
  values: [TRUE, FALSE]
}

truncation(1) FourValuedLogic {
  values: [TRUE, FALSE, BOTH, NEITHER]
}

truncation(inf) SevenValuedLogic {
  values: [TRUE, FALSE, BOTH, NEITHER, INFINITY, ZERO, FLOWING]
}

universe U_0 {
  contains: [Bool, Int, Float, Logic7]
}

universe U_1 {
  contains: [U_0, FuzzyType, NValuedType]
}

universe U_omega {
  contains: forall n -> U_n
  logic7:   INFINITY
}

universe U_empty {
  contains: empty
  logic7:   ZERO
}

path_induction LogicPathInduction {
  base: forall a: Logic7 -> refl(a): a = a
  step: forall P -> (forall a -> P(a, a, refl(a))) ->
    forall a b, forall p: a = b -> P(a, b, p)
  flowing_continuity:
    forall p: TRUE -> FALSE ->
    exists intermediate: FLOWING
}
`;
