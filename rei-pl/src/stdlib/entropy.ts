/**
 * Rei-PL 標準ライブラリ — エントロピー演算
 * Phase 7d: D-FUMTエントロピーをRei言語から使えるようにする
 */

/** Rei言語からエクスポートされるエントロピー関数群 */
export const ENTROPY_STDLIB = `
-- Rei標準ライブラリ: エントロピー演算 (entropy.rei)
-- Theory #77: D-FUMTエントロピー理論

-- 七値エントロピー計算
func dfumt_entropy(dist: Logic7Distribution) -> Float
  dist |> normalize |> map(p => p * log7(p)) |> sum |> negate

-- 古代符号との比較
func compare_ancient(h7: Float) -> AncientComparison
  {
    ancient32: log(32),    -- 壁画32符号の理論最大
    iching64: log(64),     -- 易経64卦の理論最大
    dfumt7: h7,
    expressiveness: h7 / log(32)
  }

-- 情報豊富度（D-FUMTが二値より何倍多くの情報を表現できるか）
func richness(h7: Float) -> Float
  h7 / log(2)
`;

export const DECOMP_STDLIB = `
-- Rei標準ライブラリ: 分解構造演算子 (decomp.rei)
-- Theory #79: 情報分解構造理論

-- 中心-周辺4層分解
func decompose(info: Any) -> DecompTree
  {
    core:    info |> extract_invariants,    -- 不変公理抽出
    layer1:  info |> extract_info_science,  -- 情報科学的構造
    layer2:  info |> extract_analysis,      -- 情報分析的構造
    layer3:  info |> extract_technology,    -- 情報技術的構造
    boundary: info |> extract_unknown       -- 未知・境界領域
  }

-- 圧縮可能性スコア（中心核の比率から計算）
func compression_potential(tree: DecompTree) -> Float
  tree.core.axiom_count / tree |> total_elements |> ratio
`;
