/**
 * AxiomEncoder — axiom文字列とカテゴリを記号化・圧縮する
 *
 * D-FUMT共通の演算子・概念を短い記号にマッピングし、
 * SeedTheory を EncodedSeed に変換してデータサイズを削減する。
 *
 * 短縮コードは全て「§」プレフィクスで衝突を防止する。
 */

import type { SeedTheory } from './seed-kernel';

export interface EncodedSeed {
  i: string;    // id
  a: string;    // axiom（記号化済み）
  c: string;    // category（2文字）
  k: string[];  // keywords
}

/** カテゴリ ↔ 2文字コード */
const CATEGORY_MAP: Record<string, string> = {
  'zero_extension': 'ze',
  'logic': 'lo',
  'computation': 'cp',
  'mathematics': 'ma',
  'consciousness': 'cs',
  'general': 'ge',
  'number-system': 'ns',
  'expansion': 'ex',
  'ai-integration': 'ai',
  'unified': 'un',
  'projection': 'pr',
  'cosmic': 'co',
  'african': 'af',
  'mesoamerican': 'ms',
  'oceanian': 'oc',
  'islamic': 'is',
  'category_theory': 'ct',
  'meta_axiom': 'mx',
  'circular_origin': 'cr',
  'inf_category': 'ic',
  'hott': 'ht',
  'truncation': 'tr',
  'universal_logic': 'ul',
  'nagarjuna': 'ng',
  'silence': 'sl',
};

const CATEGORY_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_MAP).map(([k, v]) => [v, k]),
);

/**
 * axiom の記号化ルール
 * §プレフィクスで衝突防止。長いフレーズから先に適用。
 */
const ENCODE_RULES: [string, string][] = [
  // 日本語フレーズ
  ['キャンセル意味論', '§cs'],
  ['四値論理', '§4v'],
  ['安定性', '§st'],
  ['ゼロ還元', '§0r'],
  ['螺旋上に配置', '§sp'],
  ['無限像=計算', '§ic'],
  ['線形結合→高次元', '§lh'],
  ['自由度', '§df'],
  ['入れ子layer', '§nl'],
  ['情報統合', '§ii'],
  ['無限分岐評価経路', '§be'],
  ['潜在真理', '§lt'],
  ['時間変化する真理値', '§tv'],
  ['未問の', '§uq'],
  ['記録事実は不変', '§im'],
  ['文脈依存拡張', '§cx'],
  ['メタ理論', '§mt'],
  ['動的平衡', '§de'],
  ['自然対数', '§ln'],
  ['黄金比', '§gr'],
  ['有限収束', '§fc'],
  ['無限拡張', '§ie'],
  ['知識変換', '§kt'],
  ['自己進化', '§se'],
  ['超論理', '§hl'],
  ['非四則演算で解', '§nf'],
  ['別の正解が共存', '§al'],
  ['非数値数学', '§nn'],
  ['多層グラフ', '§mg'],
  ['高次元構造', '§hd'],
  ['次元螺旋零点', '§dz'],
  ['生物超常', '§bs'],
  ['確率運命', '§pf'],
  ['宇宙因果', '§cc'],
  ['量子進化', '§qe'],
  ['螺旋数字', '§sn'],
  ['位相変調', '§pm'],
  ['空間投影', '§ap'],
  ['次世代記述', '§ng'],
  ['感情∨直感', '§ei'],
  ['因果,意志', '§cw'],
  ['構造=中心+周囲', '§cp'],
  ['真偽両方', '§tb'],
  ['0次元点', '§0d'],
  ['AI発見', '§ad'],
  ['形式化→0', '§f0'],
  // 英語・数学記号
  ['D-FUMT', '§DF'],
  ['Classical', '§Cl'],
  ['catuskoti', '§ck'],
  ['Topology', '§Tp'],
  ['Topo', '§tp'],
  ['HDFMT', '§HF'],
  ['UMTE', '§UM'],
  ['spiral', '§Sr'],
  ['linear', '§Lr'],
  ['point', '§Pt'],
  ['medium', '§Md'],
  ['neither', '§Nr'],
  ['Encode', '§En'],
  ['Super', '§Su'],
  ['Phys', '§Ph'],
  ['Math', '§Ma'],
  ['SUSY', '§SS'],
  ['Info', '§If'],
  ['past', '§pa'],
  ['laws', '§la'],
  ['cycle', '§cy'],
  ['Orbital', '§Or'],
  ['Cycron', '§Cy'],
  ['Fate', '§Fa'],
  ['Life', '§Li'],
  ['Destiny', '§De'],
  // 数学パターン
  ['e^(iθ)', '§eθ'],
  ['e^(iφ)', '§eφ'],
  ['e^(iωt)', '§eω'],
  ['e^(-iωt)', '§e-ω'],
  ['e^(ikr)', '§ek'],
  ['∫∫f ', '§2f'],
  ['lim', '§li'],
  ['mod ', '§%'],
  // 数式中の共通パターン
  ['n×', '§nx'],
  ['x×', '§xx'],
  ['(1/', '§1'],
  ['p⊕q', '§pq'],
  ['×(', '§*('],
  ['sin(', '§si('],
  // キーワードの共通パターン
  ['自己進化AI', '§EA'],
  ['AI超論理', '§AH'],
  ['物理数学AI', '§PA'],
  ['量子AI', '§QA'],
  ['不可逆性', '§ir'],
  ['認知空間', '§ks'],
  ['運命方程式', '§fe'],
  ['超対称性', '§sy'],
  ['量子情報', '§qi'],
  ['生命創造', '§lc'],
  ['多次元投影', '§mp'],
  ['位相変調', '§pM'],
  ['情報系列', '§is'],
  ['記号拡張', '§sx'],
  ['量子位相', '§qp'],
  ['ホログラム', '§ho'],
  ['ポリゴン', '§pg'],
  ['オービタル', '§ob'],
  ['循環数', '§cn'],
  ['時間逆行', '§tr'],
  ['逆行数', '§rn'],
  ['無時間性', '§tl'],
  ['時相数', '§tn'],
  ['点数体系', '§ps'],
  ['メタ数理', '§mr'],
  ['超記号', '§hs'],
  ['縮小ゼロ', '§c0'],
  ['分解解析', '§da'],
  ['直感数学', '§im2'],
  ['時間数学', '§tm'],
  ['非数数学', '§nm'],
  ['多層ネット', '§mn'],
  ['知識逆流', '§kr'],
  ['φ縮小', '§φc'],
  ['π縮小', '§πc'],
  ['e縮小', '§ec'],
  ['無限縮小', '§∞c'],
  ['無限拡張', '§∞e'],
  // ②追加ルール
  ['→∞展開', '§∞x'],
  ['lim(1/n)', '§L0'],
  ['=lim f(n)=L', '§Lf'],
  ['n→∞', '§n∞'],
  ['AI(t+1)', '§A+'],
  ['AI(t)', '§At'],
  ['N¹⊂N²⊂N³⊂N⁴⊂N⁵', '§N5'],
  ['∫K(τ)dτ', '§Kt'],
  ['∫T(τ)dτ', '§Tt'],
  ['∫ρ_info×G dx\'', '§IG'],
  ['∫(Phys×Math×AI)dt', '§PMA'],
  ['∑αᵢ|ψᵢ⟩', '§Qψ'],
  ['A×sin(2πft+φ)', '§Asf'],
  ['{x∈ℝⁿ,n>4}', '§Rn4'],
  ['{T₁..Tₙ}', '§Tn'],
  ['T=⊕Tᵢ', '§T⊕'],
  ['{s₁→s₂→..sₙ}', '§Sn'],
  ['⋃[0..∞]', '§U∞'],
  ['lim[形式化→0]', '§lf0'],
];

export class AxiomEncoder {
  /** axiom文字列を記号化して短縮する */
  encode(axiom: string): string {
    let result = axiom;
    for (const [from, to] of ENCODE_RULES) {
      result = result.replaceAll(from, to);
    }
    return result;
  }

  /** 記号化されたaxiomを元に戻す */
  decode(encoded: string): string {
    let result = encoded;
    for (let i = ENCODE_RULES.length - 1; i >= 0; i--) {
      const [original, short] = ENCODE_RULES[i];
      result = result.replaceAll(short, original);
    }
    return result;
  }

  /** カテゴリ名を2文字に短縮する */
  encodeCategory(category: string): string {
    const code = CATEGORY_MAP[category];
    if (!code) throw new Error(`Unknown category: ${category}`);
    return code;
  }

  /** 2文字カテゴリを元に戻す */
  decodeCategory(encoded: string): string {
    const category = CATEGORY_REVERSE[encoded];
    if (!category) throw new Error(`Unknown category code: ${encoded}`);
    return category;
  }

  /** 種全体をエンコードする */
  encodeSeed(seed: SeedTheory): EncodedSeed {
    return {
      i: seed.id,
      a: this.encode(seed.axiom),
      c: this.encodeCategory(seed.category),
      k: seed.keywords,
    };
  }

  /** エンコードされた種をデコードする */
  decodeSeed(encoded: EncodedSeed): SeedTheory {
    return {
      id: encoded.i,
      axiom: this.decode(encoded.a),
      category: this.decodeCategory(encoded.c),
      keywords: encoded.k,
    };
  }
}
