/**
 * Rei-AIOS STEP 7-B — SEED_KERNEL Extended
 * D-FUMT Theory #76〜#100 の追加登録
 * 意識数学SAC・UMTE・非数値数学・MMRT/AMRT を体系化
 */

export interface ExtendedTheory {
  id: number;
  name: string;
  category: ExtendedCategory;
  description: string;
  formula?: string;
  dfumtValue: string;
  relatedIds: number[];
}

export type ExtendedCategory =
  | 'consciousness_math'  // 意識数学 SAC C1-C6
  | 'umte'               // UMTE U1-U5
  | 'non_numerical'      // 非数値数学
  | 'mmrt_amrt'          // MMRT/AMRT
  | 'dfumt_extension'    // D-FUMT拡張理論
  | 'axiom_network';     // 公理ネットワーク理論

export const EXTENDED_THEORIES: ExtendedTheory[] = [
  // ─── 意識数学 SAC C1-C6 (#76〜#81) ──────────────────────
  { id: 76, name: 'SAC-C1: 意識存在公理',
    category: 'consciousness_math',
    description: '意識は観察の行為によって初めて存在する。量子力学の観察問題をD-FUMTで形式化。',
    formula: 'C(x) := observe(x) → x ∈ BOTH',
    dfumtValue: 'BOTH', relatedIds: [7, 23] },
  { id: 77, name: 'SAC-C2: 意識の非局所性',
    category: 'consciousness_math',
    description: '意識は空間的制約を持たない。INFINITY値での表現。',
    formula: 'C_nonlocal := ∀x,y: dist(x,y) → C(x) ≡ C(y)',
    dfumtValue: 'INFINITY', relatedIds: [76, 3] },
  { id: 78, name: 'SAC-C3: 意識の再帰性',
    category: 'consciousness_math',
    description: '意識は自己を認識できる。ゲーデル不完全性定理との対応。',
    formula: 'C_recursive := C(C(x)) = C(x)',
    dfumtValue: 'FLOWING', relatedIds: [76, 77] },
  { id: 79, name: 'SAC-C4: 意識の縁起性',
    category: 'consciousness_math',
    description: '意識は他の意識との関係によって生じる。龍樹の空論との接続。',
    formula: 'C_dependent := C(x) ← ∃y: relate(x, y)',
    dfumtValue: 'NEITHER', relatedIds: [76, 1] },
  { id: 80, name: 'SAC-C5: 意識の圧縮性',
    category: 'consciousness_math',
    description: '意識は情報を最小記述に圧縮する。RCT（Theory #67）の意識的基盤。',
    formula: 'C_compress := K(C(x)) ≤ K(x)',
    dfumtValue: 'ZERO', relatedIds: [67, 78] },
  { id: 81, name: 'SAC-C6: 意識の七価完全性',
    category: 'consciousness_math',
    description: '意識は七価論理の全値を経験できる完全な評価者。',
    formula: 'C_complete := C: experience → {⊤,⊥,B,N,∞,〇,～}',
    dfumtValue: 'BOTH', relatedIds: [23, 76] },

  // ─── UMTE U1-U5 (#82〜#86) ────────────────────────────
  { id: 82, name: 'UMTE-U1: 統一数学基盤',
    category: 'umte',
    description: '数学の全体系を七価論理の上に再構築する統一理論の基底。',
    formula: 'U_base := ∀theorem ∈ Math: eval_7(theorem) ≠ ⊥',
    dfumtValue: 'TRUE', relatedIds: [23, 1] },
  { id: 83, name: 'UMTE-U2: 連続と離散の統一',
    category: 'umte',
    description: '実数（連続）と自然数（離散）をFLOWING値で接続する。',
    formula: 'U_continuous := ∀n ∈ ℕ: ∃r ∈ ℝ: FLOWING(n, r)',
    dfumtValue: 'FLOWING', relatedIds: [5, 3] },
  { id: 84, name: 'UMTE-U3: 無限の七価分類',
    category: 'umte',
    description: 'カントールの濃度理論を七価論理で再分類。',
    formula: 'U_infinite := |ℕ| → INFINITY; |ℝ| → ∞²',
    dfumtValue: 'INFINITY', relatedIds: [3, 82] },
  { id: 85, name: 'UMTE-U4: 証明の等価性',
    category: 'umte',
    description: '異なる証明経路が同じ定理に至るとき、意味的等価。Phase 8aの理論的基盤。',
    formula: 'U_equiv := proof_1(T) ≡ proof_2(T) → equiv_score = 1.0',
    dfumtValue: 'TRUE', relatedIds: [84, 12] },
  { id: 86, name: 'UMTE-U5: 数学的存在の縁起',
    category: 'umte',
    description: '数学的対象は相互関係によってのみ存在する。公理依存グラフの数学的正当化。',
    formula: 'U_exist := ∃x ∈ Math ← ∃y: relate(x, y)',
    dfumtValue: 'NEITHER', relatedIds: [85, 7] },

  // ─── 非数値数学 (#87〜#91) ────────────────────────────
  { id: 87, name: '非数値数学-基底定理',
    category: 'non_numerical',
    description: '数値を使わない数学体系の構築。関係と変換のみで数学を表現。',
    formula: 'NNM_base := ∀theorem: ¬∃n ∈ ℝ in proof(theorem)',
    dfumtValue: 'NEITHER', relatedIds: [12, 1] },
  { id: 88, name: '非数値数学-色彩位相',
    category: 'non_numerical',
    description: '色彩空間の位相的性質を数値なしで記述。',
    formula: 'NNM_color := hue ↔ saturation ↔ brightness (non-numeric)',
    dfumtValue: 'BOTH', relatedIds: [87] },
  { id: 89, name: '非数値数学-音楽論理',
    category: 'non_numerical',
    description: '音楽の和声・対位法を七価論理で表現。',
    formula: 'NNM_music := consonance → TRUE; dissonance → BOTH',
    dfumtValue: 'FLOWING', relatedIds: [87, 88] },
  { id: 90, name: '非数値数学-言語数学',
    category: 'non_numerical',
    description: '自然言語の意味論を数値なしで形式化。ウィトゲンシュタインとの接続。',
    formula: 'NNM_lang := meaning(w) := {contexts(w)}',
    dfumtValue: 'FLOWING', relatedIds: [87] },
  { id: 91, name: '非数値数学-絵画位相',
    category: 'non_numerical',
    description: '絵画の構図・遠近法を位相空間として記述。',
    formula: 'NNM_paint := perspective := topology(canvas)',
    dfumtValue: 'BOTH', relatedIds: [88, 90] },

  // ─── MMRT/AMRT (#92〜#96) ─────────────────────────────
  { id: 92, name: 'MMRT: 最大最小再帰定理',
    category: 'mmrt_amrt',
    description: '任意の再帰構造において、最大値と最小値は同一の縁起関係を持つ。',
    formula: 'MMRT := max(f) ↔ min(f) via recursive_structure',
    dfumtValue: 'BOTH', relatedIds: [5, 67] },
  { id: 93, name: 'AMRT: 非対称再帰変換定理',
    category: 'mmrt_amrt',
    description: '非対称な再帰変換が収束する条件をD-FUMTで表現。',
    formula: 'AMRT := asymmetric_f: converge ↔ FLOWING → TRUE',
    dfumtValue: 'FLOWING', relatedIds: [92] },
  { id: 94, name: 'MMRT-螺旋拡張',
    category: 'mmrt_amrt',
    description: 'MMRTを螺旋数論（Theory #5）と統合。黄金比収束の証明。',
    formula: 'MMRT_spiral := limit(spiral(φ^n)) = ZERO',
    dfumtValue: 'ZERO', relatedIds: [92, 5] },
  { id: 95, name: 'AMRT-意識変換',
    category: 'mmrt_amrt',
    description: '意識の変容過程をAMRTで記述。瞑想・悟りの数学的モデル。',
    formula: 'AMRT_conscious := transform(C_n) → C_{n+1}: FLOWING',
    dfumtValue: 'FLOWING', relatedIds: [93, 79] },
  { id: 96, name: 'MMRT/AMRT統合定理',
    category: 'mmrt_amrt',
    description: 'MMRTとAMRTを統合する上位定理。対称性と非対称性の統一。',
    formula: 'UNIFIED := MMRT ∪ AMRT → BOTH',
    dfumtValue: 'BOTH', relatedIds: [92, 93] },

  // ─── D-FUMT拡張理論 (#97〜#100) ─────────────────────
  { id: 97, name: 'D-FUMT拡張: 八価論理可能性',
    category: 'dfumt_extension',
    description: '七価論理の次——「超越的沈黙」を第八値として検討。現時点では保留。',
    formula: 'DFUMT_8 := {⊤,⊥,B,N,∞,〇,～, ?}',
    dfumtValue: 'NEITHER', relatedIds: [23] },
  { id: 98, name: 'D-FUMT: 量子論理との対応',
    category: 'dfumt_extension',
    description: '量子重ね合わせ状態とBOTH値の対応。測定問題との関係。',
    formula: 'QUANTUM := |ψ⟩ = α|0⟩ + β|1⟩ ↔ BOTH',
    dfumtValue: 'BOTH', relatedIds: [23, 76] },
  { id: 99, name: 'D-FUMT: 圏論的定式化',
    category: 'dfumt_extension',
    description: '七価論理を圏論の射（morphism）として定式化。',
    formula: 'CATEGORY := 7VAL: C → D (functor)',
    dfumtValue: 'FLOWING', relatedIds: [23, 82] },
  { id: 100, name: 'D-FUMT第100理論: 公理ネットワーク完全性',
    category: 'axiom_network',
    description: '全D-FUMT理論が相互に参照し合う完全グラフを形成するとき、新しい理論は自動的に生成される。',
    formula: 'COMPLETENESS := ∀T_i,T_j ∈ DFUMT: ∃path(T_i → T_j)',
    dfumtValue: 'TRUE', relatedIds: [1, 23, 67, 75] },
];

// ─── カテゴリ別取得 ───────────────────────────────────────────
export function getTheoriesByCategory(cat: ExtendedCategory): ExtendedTheory[] {
  return EXTENDED_THEORIES.filter(t => t.category === cat);
}

// ─── ID検索 ──────────────────────────────────────────────────
export function getTheoryById(id: number): ExtendedTheory | undefined {
  return EXTENDED_THEORIES.find(t => t.id === id);
}

// ─── 依存グラフ ──────────────────────────────────────────────
export function buildDependencyGraph(): Map<number, number[]> {
  const graph = new Map<number, number[]>();
  for (const t of EXTENDED_THEORIES) {
    graph.set(t.id, t.relatedIds);
  }
  return graph;
}
