/**
 * Seed Kernel — 87理論の「種」最小表現
 *
 * フルデータ（name・description）を持たず、
 * axiom + category + keywords のみで理論を定義する。
 * TheoryGenerator で必要時にフルデータへ再展開する。
 */

export interface SeedTheory {
  id: string;
  axiom: string;
  category: string;
  keywords: string[];
}

export const SEED_KERNEL: SeedTheory[] = [
  // ── Core 15 theories ──
  { id: 'dfumt-zero-pi', axiom: 'π×π⁻¹=1 キャンセル意味論', category: 'zero_extension', keywords: ['ゼロπ', 'pi'] },
  { id: 'dfumt-catuskoti', axiom: '真偽両方neither 四値論理', category: 'logic', keywords: ['四価論理', '龍樹'] },
  { id: 'dfumt-idempotency', axiom: 'Ω(Ω(x))→Ω(x) 安定性', category: 'computation', keywords: ['冪等性', 'omega'] },
  { id: 'dfumt-contraction-zero', axiom: '⊖(x) ゼロ還元', category: 'zero_extension', keywords: ['縮約ゼロ', '⊖'] },
  { id: 'dfumt-spiral-number', axiom: '数は螺旋上に配置', category: 'mathematics', keywords: ['螺旋数', 'phi'] },
  { id: 'dfumt-facing-mirror', axiom: '二枚の鏡=無限像=計算', category: 'computation', keywords: ['対面鏡', '再帰'] },
  { id: 'dfumt-linear-point', axiom: '点の線形結合→高次元', category: 'mathematics', keywords: ['線形点', '次元'] },
  { id: 'dfumt-dimension', axiom: 'd=自由度 d→∞展開', category: 'mathematics', keywords: ['次元', 'infinity'] },
  { id: 'dfumt-space-layer', axiom: '計算空間=入れ子layer', category: 'computation', keywords: ['空間層', 'layer'] },
  { id: 'dfumt-consciousness-math', axiom: 'C1-C5 意識=情報統合 Φ>0', category: 'consciousness', keywords: ['意識', 'IIT'] },
  { id: 'dfumt-infinity-value', axiom: '∞=無限分岐評価経路', category: 'logic', keywords: ['∞値', '無限'] },
  { id: 'dfumt-zero-state', axiom: '〇=未問の潜在真理', category: 'logic', keywords: ['〇値', '未観測'] },
  { id: 'dfumt-flowing-value', axiom: '～=時間変化する真理値', category: 'logic', keywords: ['～値', '流動'] },
  { id: 'dfumt-center-periphery', axiom: '構造=中心+周囲', category: 'general', keywords: ['中心', '周囲'] },
  { id: 'dfumt-irreversibility', axiom: '記録事実は不変', category: 'general', keywords: ['不可逆性', 'witness'] },

  // ── 数体系 (number-system) ──
  { id: 'dfumt-hyper-symbol', axiom: 'S̃=f(S,ctx) 文脈依存拡張', category: 'number-system', keywords: ['超記号', '文脈'] },
  { id: 'dfumt-five-number-systems', axiom: 'N¹⊂N²⊂N³⊂N⁴⊂N⁵', category: 'number-system', keywords: ['5数体系', '変換'] },
  { id: 'dfumt-meta-numerology', axiom: 'M(T)={T\'|メタ理論}', category: 'number-system', keywords: ['メタ数理', '階層'] },
  { id: 'dfumt-hdfmt', axiom: 'F_n=∫Ψ(x₁..xₙ) n→∞', category: 'number-system', keywords: ['HDFMT', '超次元'] },
  { id: 'dfumt-point-number-system', axiom: 'P={p|0次元点} p⊕q≠p+q', category: 'number-system', keywords: ['点数体系', '0次元'] },
  { id: 'dfumt-temporal-number-system', axiom: 'Tₜ(n)=n×e^(iωt)', category: 'number-system', keywords: ['時相数', '動的'] },
  { id: 'dfumt-timeless-number-system', axiom: '∀t:T∅(n)=n 恒常', category: 'number-system', keywords: ['無時間性', '恒常'] },
  { id: 'dfumt-time-reversal-number', axiom: 'T⁻¹=n×e^(-iωt) 逆行', category: 'number-system', keywords: ['時間逆行', '逆行数'] },
  { id: 'dfumt-unified-number-system', axiom: 'U³=spiral⊕linear⊕point', category: 'number-system', keywords: ['統合数', 'U³'] },

  // ── 拡張・縮小 (expansion) ──
  { id: 'dfumt-zero-pi-expansion', axiom: 'ZPE(x)=x⊕0⊕π=x̃', category: 'expansion', keywords: ['ZPE', 'pi'] },
  { id: 'dfumt-inverse-zero-pi', axiom: 'IZPE(ZPE(x))=x', category: 'expansion', keywords: ['IZPE', '逆写像'] },
  { id: 'dfumt-contraction-zero-theory', axiom: 'C₀=lim(1/n)=0⁺', category: 'expansion', keywords: ['縮小ゼロ', '0⁺'] },
  { id: 'dfumt-pi-contraction', axiom: 'C_π=x×(1/π)^n→0', category: 'expansion', keywords: ['π縮小', 'pi'] },
  { id: 'dfumt-e-contraction', axiom: 'C_e=x×(1/e)^n', category: 'expansion', keywords: ['e縮小', '自然対数'] },
  { id: 'dfumt-phi-contraction', axiom: 'C_φ=x×(1/φ)^n', category: 'expansion', keywords: ['φ縮小', 'phi'] },
  { id: 'dfumt-infinite-contraction', axiom: 'IC(∞)=lim f(n)=L', category: 'expansion', keywords: ['無限縮小', 'infinity'] },
  { id: 'dfumt-infinite-expansion', axiom: 'IE=⋃[0..∞]xⁿ', category: 'expansion', keywords: ['無限拡張', 'infinity'] },
  { id: 'dfumt-knowledge-reverse-flow', axiom: 'K\'=∫K(τ)dτ→K̃', category: 'expansion', keywords: ['知識逆流', '変換'] },

  // ── AI統合 (ai-integration) ──
  { id: 'dfumt-self-evolving-ai', axiom: 'AI(t+1)=f(AI(t),E(t))', category: 'ai-integration', keywords: ['自己進化AI', '適応'] },
  { id: 'dfumt-ai-hyper-logic', axiom: 'AHL(x)⊃Classical(x)', category: 'ai-integration', keywords: ['AI超論理', '超論理'] },
  { id: 'dfumt-physics-ai-math', axiom: 'Φ_AI=∫(Phys×Math×AI)dt', category: 'ai-integration', keywords: ['物理数学AI', '統合'] },
  { id: 'dfumt-future-ai-unified', axiom: 'FGAIUT=⋃AI_gen×D-FUMT', category: 'ai-integration', keywords: ['FGAIUT', '未来AI'] },
  { id: 'dfumt-ai-math-discovery', axiom: 'D_AI={M\'|AI発見}', category: 'ai-integration', keywords: ['AIMD', '自律'] },
  { id: 'dfumt-quantum-self-evolving-ai', axiom: 'QSEA=∑αᵢ|ψᵢ⟩×AI(t)', category: 'ai-integration', keywords: ['QSEA', '量子AI'] },

  // ── 統合・応用 (unified) ──
  { id: 'dfumt-umte', axiom: 'UMTE=⋃[∀T∈D-FUMT]T', category: 'unified', keywords: ['UMTE', '万物統一'] },
  { id: 'dfumt-umtm', axiom: 'M=A×sin(2πft+φ)×D-FUMT', category: 'unified', keywords: ['UMTM', '音楽'] },
  { id: 'dfumt-imrt', axiom: 'IMRT(T)=T⁻¹', category: 'unified', keywords: ['IMRT', '逆数理'] },
  { id: 'dfumt-mmrt', axiom: 'MMRT:非四則演算で解', category: 'unified', keywords: ['MMRT', '超数学'] },
  { id: 'dfumt-amrt', axiom: 'AMRT:別の正解が共存', category: 'unified', keywords: ['AMRT', '別数理'] },
  { id: 'dfumt-supersymmetric-math', axiom: 'x+x̃=0_super', category: 'unified', keywords: ['超対称', 'SUSY'] },
  { id: 'dfumt-info-field-math', axiom: 'I=∫ρ_info×G dx\'', category: 'unified', keywords: ['情報場', '場理論'] },
  { id: 'dfumt-chrono-math', axiom: 'C(t₁,t₂)=∫T(τ)dτ', category: 'unified', keywords: ['時間数学', 'chrono'] },
  { id: 'dfumt-non-numerical-math', axiom: 'NNM∈Ω\\ℝ 非数値数学', category: 'unified', keywords: ['非数数学', '直感'] },
  { id: 'dfumt-multi-layer-network', axiom: 'G=(V,E,L) 多層グラフ', category: 'unified', keywords: ['多層ネット', 'グラフ'] },
  { id: 'dfumt-multi-dim-structure', axiom: 'S_n={x∈ℝⁿ,n>4}', category: 'unified', keywords: ['多次元', '高次元'] },
  { id: 'dfumt-intuitive-math', axiom: 'I(T)=lim[形式化→0]T', category: 'unified', keywords: ['直感数学', '証明前'] },
  { id: 'dfumt-uhdmt', axiom: 'UHDMT=HDFMT∪UMTE∪全sub', category: 'unified', keywords: ['UHDMT', '最上位'] },
  { id: 'dfumt-decomposition-analysis', axiom: 'D(T)={T₁..Tₙ} T=⊕Tᵢ', category: 'unified', keywords: ['分解解析', '再統合'] },
  { id: 'dfumt-eternal-infinite-eq', axiom: 'EIE=∑f(n)×D-FUMT(n)', category: 'unified', keywords: ['EIE', 'infinity'] },
  { id: 'dfumt-isnt', axiom: 'ISNT={s₁→s₂→..sₙ}', category: 'unified', keywords: ['ISNT', '情報系列'] },
  { id: 'dfumt-uset', axiom: 'USET={s̃|s̃⊃s}', category: 'unified', keywords: ['USET', '記号拡張'] },
  { id: 'dfumt-tetravalent-zero-pi', axiom: 'T0π=catuskoti×ZPE', category: 'unified', keywords: ['T0πT', '統合'] },
  { id: 'dfumt-dszt', axiom: 'DSZT=d×e^(iθ)×δ(x₀)', category: 'unified', keywords: ['DSZT', '零点'] },
  { id: 'dfumt-zpqtmt', axiom: 'ZPQTMT=ZPE⊗|ψ⟩⊗Topo', category: 'unified', keywords: ['ZPQTMT', '量子位相'] },

  // ── 投影・可視化 (projection) ──
  { id: 'dfumt-multidim-projection', axiom: 'P_n→m=Σaᵢφᵢ(x)', category: 'projection', keywords: ['多次元投影', '可視化'] },
  { id: 'dfumt-mppt', axiom: 'MPPT={xᵢ=f(θᵢ)}', category: 'projection', keywords: ['MPPT', 'ポリゴン'] },
  { id: 'dfumt-hmpt', axiom: 'H=∫∫f e^(ikr)dxdy', category: 'projection', keywords: ['HMPT', 'ホログラム'] },
  { id: 'dfumt-asp-mt', axiom: 'ASP=f(x)×G(medium)', category: 'projection', keywords: ['ASP-MT', '空間投影'] },
  { id: 'dfumt-ngiet', axiom: 'NGIET=Encode(I,Σ_hyper)', category: 'projection', keywords: ['NGIET', '次世代'] },

  // ── 宇宙・物理 (cosmic) ──
  { id: 'dfumt-bspt', axiom: 'BSP=∫Bio×Super dt', category: 'cosmic', keywords: ['BSPT', '生物'] },
  { id: 'dfumt-pft', axiom: 'Fate=∑P(eᵢ)×eᵢ', category: 'cosmic', keywords: ['PFT', '確率'] },
  { id: 'dfumt-ccd', axiom: 'CCD=f(past,laws)', category: 'cosmic', keywords: ['CCD', '宇宙因果'] },
  { id: 'dfumt-itsus', axiom: 'ITSUS=lim SUSY×Topo', category: 'cosmic', keywords: ['ITSUS', '超対称性'] },
  { id: 'dfumt-hdrqi', axiom: 'HDRQI=GR×QM×Info', category: 'cosmic', keywords: ['HDRQI', '量子情報'] },
  { id: 'dfumt-life-creation', axiom: 'Life=f(M,E,I,C)', category: 'cosmic', keywords: ['生命創造', '意識'] },
  { id: 'dfumt-cognitive-space', axiom: 'C_space={感情∨直感}', category: 'cosmic', keywords: ['認知空間', '感情'] },
  { id: 'dfumt-probabilistic-destiny', axiom: 'Destiny=f(因果,意志)', category: 'cosmic', keywords: ['運命方程式', '意志'] },

  // ── AI提案統合 (number-system) ──
  { id: 'dfumt-orbital-spiral', axiom: 'Orbital=n×e^(iθ)', category: 'number-system', keywords: ['オービタル', '螺旋'] },
  { id: 'dfumt-pmn', axiom: 'PMN=x×e^(iφ)', category: 'number-system', keywords: ['PMN', '位相変調'] },
  { id: 'dfumt-cycron', axiom: 'Cycron=n mod cycle', category: 'number-system', keywords: ['Cycron', '循環数'] },

  // ── Maya × Aztec 情報科学理論 (Theory #68〜72) ──
  { id: 'dfumt-maya-code', axiom: 'マヤ三層符号: 表意×表音×音節=最小記述長', category: 'computation', keywords: ['マヤ符号', 'ハフマン', '可変長符号', 'hybrid encoding'] },
  { id: 'dfumt-entropy-zero', axiom: 'H(ZERO)=log₂(7) 最大潜在エントロピー=マヤのゼロ', category: 'mathematics', keywords: ['シャノンエントロピー', 'ZERO', '潜在情報量', 'information theory'] },
  { id: 'dfumt-aztec-geometry', axiom: '複雑空間=凸多角形の和集合 アステカ土地測量公理', category: 'mathematics', keywords: ['ポリゴン分解', 'アステカ', '空間分割', 'Shoelace'] },
  { id: 'dfumt-maya-distributed', axiom: '複数プロセス=独立暦 同期点=七価合意 マヤ分散理論', category: 'computation', keywords: ['分散コンピューティング', 'マヤ暦', '合意アルゴリズム', 'consensus'] },
  { id: 'dfumt-aztec-cycle', axiom: 'LCM(p1,p2)=合流点 アステカ52年=周期合流公理', category: 'mathematics', keywords: ['最小公倍数', 'アステカ', '周期', 'LCM', 'synchronization'] },

  // ── ギリシャ神話理論 (Theory #73〜76) ──
  { id: 'dfumt-moira', axiom: 'クロト×ラケシス×アトロポス 生成・評価・終了の三相公理', category: 'computation', keywords: ['モイラ', '終了条件', '廃棄', 'termination', 'lifecycle'] },
  { id: 'dfumt-prometheus', axiom: 'プロメテウス降下: 公理は受け手のレベルに変換されなければならない', category: 'ai-integration', keywords: ['プロメテウス', '知識降下', '変換', 'knowledge transfer'] },
  { id: 'dfumt-narcissus', axiom: '自己参照ループは必ずバイアスを生む ナルキッソス盲点公理', category: 'logic', keywords: ['ナルキッソス', '自己参照', 'メタ認知', 'self-loop', 'blind spot'] },
  { id: 'dfumt-ariadne', axiom: '全推論は起点への糸を持つ アリアドネ逆引き公理', category: 'computation', keywords: ['アリアドネ', '逆引き', 'backtrace', 'tracing', 'labyrinth'] },

  // ── 公理の逆理論 (Theory #77〜79) ──
  { id: 'dfumt-anti-axiom', axiom: '¬A は A と BOTH 状態で共存し新体系の種となる', category: 'logic', keywords: ['反公理', '否定', 'anti-axiom', '非ユークリッド'] },
  { id: 'dfumt-theorem', axiom: '公理→定理: 演繹は SEED_KERNEL を無限に展開する', category: 'logic', keywords: ['定理', '演繹', 'theorem', 'deduction', 'modus ponens'] },
  { id: 'dfumt-no-axiom', axiom: 'ZERO は全公理の母体 現れと帰還の循環が創造の本質', category: 'general', keywords: ['無公理', 'ZERO', '無', '創造', 'void', '循環'] },
];
