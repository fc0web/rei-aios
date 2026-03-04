/**
 * 公理OS — 初期シードデータ
 *
 * 東洋11名 + 西洋9名 = 20人物
 * D-FUMT理論75件、公理2件
 */

import type { PersonInsert, TheoryInsert, AxiomInsert } from './types';

// ═══════════════════════════════════════════
// 人物（東洋 11名）
// ═══════════════════════════════════════════

export const SEED_PERSONS: PersonInsert[] = [
  // ── 東洋 ──
  {
    id: 'himiko',
    name_ja: '卑弥呼',
    name_en: 'Himiko',
    period: '170頃 – 248頃',
    region: 'east_asia',
    domains: ['politics', 'religion'],
    core_axiom: '鬼道を以て衆を惑わす ── 祭政一致の統治と神託による共同体の統合',
    thought_keywords: ['鬼道', '邪馬台国', '祭政一致', '神託', '魏志倭人伝'],
    is_free: true,
  },
  {
    id: 'shotoku-taishi',
    name_ja: '聖徳太子',
    name_en: 'Prince Shōtoku',
    period: '574 – 622',
    region: 'east_asia',
    domains: ['politics', 'philosophy', 'religion'],
    core_axiom: '和を以て貴しとなす ── 調和による統治と三宝（仏法僧）への帰依',
    thought_keywords: ['十七条憲法', '和', '三宝', '冠位十二階', '仏教受容'],
    is_free: true,
  },
  {
    id: 'buddha',
    name_ja: '仏陀（ゴータマ・シッダールタ）',
    name_en: 'Siddhartha Gautama (Buddha)',
    period: '563 BC – 483 BC',
    region: 'south_asia',
    domains: ['philosophy', 'religion', 'education'],
    core_axiom: '四諦 ── 苦・集・滅・道。苦の原因を知り、苦を滅する道を歩め',
    thought_keywords: ['四諦', '八正道', '縁起', '空', '中道', '無常'],
    is_free: true,
  },
  {
    id: 'nagarjuna',
    name_ja: '龍樹（ナーガールジュナ）',
    name_en: 'Nāgārjuna',
    period: '150頃 – 250頃',
    region: 'south_asia',
    domains: ['philosophy', 'logic', 'religion'],
    core_axiom: '空（シューニャター） ── 一切の存在は自性を持たず、縁起によってのみ成立する',
    thought_keywords: ['空', '中論', '中観派', '二諦説', '八不中道', '縁起'],
    is_free: true,
  },
  {
    id: 'confucius',
    name_ja: '孔子',
    name_en: 'Confucius',
    period: '551 BC – 479 BC',
    region: 'east_asia',
    domains: ['philosophy', 'education', 'ethics'],
    core_axiom: '仁 ── 人を愛すること。礼によって秩序を保ち、学び続けることが君子の道',
    thought_keywords: ['仁', '礼', '孝', '君子', '中庸', '論語'],
    is_free: true,
  },
  {
    id: 'laozi',
    name_ja: '老子',
    name_en: 'Laozi',
    period: '6世紀 BC頃',
    region: 'east_asia',
    domains: ['philosophy'],
    core_axiom: '道 ── 万物の根源は名づけがたき「道」。無為自然に従え',
    thought_keywords: ['道', '無為自然', '柔弱', '道徳経', '陰陽', '虚'],
    is_free: true,
  },
  {
    id: 'zhuangzi',
    name_ja: '荘子',
    name_en: 'Zhuangzi',
    period: '369 BC頃 – 286 BC頃',
    region: 'east_asia',
    domains: ['philosophy'],
    core_axiom: '万物斉同 ── 是非・善悪・生死の区別は人為的。道の立場からは万物は等しい',
    thought_keywords: ['万物斉同', '胡蝶の夢', '逍遥遊', '無用の用', '坐忘', '道'],
    is_free: true,
  },
  {
    id: 'kukai',
    name_ja: '空海',
    name_en: 'Kūkai',
    period: '774 – 835',
    region: 'east_asia',
    domains: ['philosophy', 'religion', 'language'],
    core_axiom: '即身成仏 ── この身このままで仏となる。六大（地水火風空識）は法界に遍満する',
    thought_keywords: ['即身成仏', '真言密教', '六大', '声字実相', '三密', '曼荼羅'],
    is_free: true,
  },
  {
    id: 'ganjin',
    name_ja: '鑑真',
    name_en: 'Jianzhen (Ganjin)',
    period: '688 – 763',
    region: 'east_asia',
    domains: ['religion', 'education', 'ethics'],
    core_axiom: '戒律 ── 正しき行いの規範を伝えること。五度の失敗と失明を越え、誓願を果たす不退転の意志',
    thought_keywords: ['戒律', '律宗', '唐招提寺', '渡海', '授戒', '不退転'],
    is_free: true,
  },
  {
    id: 'dogen',
    name_ja: '道元',
    name_en: 'Dōgen',
    period: '1200 – 1253',
    region: 'east_asia',
    domains: ['philosophy', 'religion'],
    core_axiom: '修証一等 ── 修行と悟りは別物ではない。只管打坐（ただ坐る）こと自体が仏法',
    thought_keywords: ['修証一等', '只管打坐', '正法眼蔵', '有時', '現成公案', '身心脱落'],
    is_free: true,
  },
  {
    id: 'shinran',
    name_ja: '親鸞',
    name_en: 'Shinran',
    period: '1173 – 1263',
    region: 'east_asia',
    domains: ['philosophy', 'religion'],
    core_axiom: '他力本願 ── 自力の限界を知り、阿弥陀仏の本願に身を委ねることが真の救い',
    thought_keywords: ['他力本願', '悪人正機', '歎異抄', '念仏', '自然法爾', '浄土真宗'],
    is_free: true,
  },

  // ── 西洋 ──
  {
    id: 'socrates',
    name_ja: 'ソクラテス',
    name_en: 'Socrates',
    period: '469 BC – 399 BC',
    region: 'europe_ancient',
    domains: ['philosophy', 'logic', 'education'],
    core_axiom: '無知の知 ── 自分が何も知らないことを知ることが、知恵の始まりである',
    thought_keywords: ['無知の知', '問答法', '産婆術', '魂の配慮', 'ダイモニオン'],
    is_free: true,
  },
  {
    id: 'plato',
    name_ja: 'プラトン',
    name_en: 'Plato',
    period: '428 BC – 348 BC',
    region: 'europe_ancient',
    domains: ['philosophy', 'logic', 'mathematics', 'education'],
    core_axiom: 'イデア論 ── 感覚世界の背後に、永遠不変のイデア（真の実在）が存在する',
    thought_keywords: ['イデア論', '洞窟の比喩', '哲人王', 'アカデメイア', '想起説', '善のイデア'],
    is_free: true,
  },
  {
    id: 'aristotle',
    name_ja: 'アリストテレス',
    name_en: 'Aristotle',
    period: '384 BC – 322 BC',
    region: 'europe_ancient',
    domains: ['philosophy', 'logic', 'science', 'ethics'],
    core_axiom: '形相と質料 ── 万物は質料（素材）と形相（形式・目的）の合一として存在する',
    thought_keywords: ['形相質料論', '四原因説', '中庸', 'エウダイモニア', '三段論法', 'オルガノン'],
    is_free: true,
  },
  {
    id: 'descartes',
    name_ja: 'デカルト',
    name_en: 'René Descartes',
    period: '1596 – 1650',
    region: 'europe_modern',
    domains: ['philosophy', 'mathematics', 'science'],
    core_axiom: 'コギト・エルゴ・スム ── 我思う、ゆえに我あり。疑い得ぬ確実な出発点',
    thought_keywords: ['方法的懐疑', 'コギト', '心身二元論', '明晰判明', '省察', '座標幾何学'],
    is_free: true,
  },
  {
    id: 'spinoza',
    name_ja: 'スピノザ',
    name_en: 'Baruch Spinoza',
    period: '1632 – 1677',
    region: 'europe_modern',
    domains: ['philosophy', 'ethics', 'logic'],
    core_axiom: '神即自然 ── 神と自然は同一。唯一の実体が無限の属性で自己表現する',
    thought_keywords: ['神即自然', '実体一元論', 'エチカ', 'コナトゥス', '能産的自然', '幾何学的方法'],
    is_free: true,
  },
  {
    id: 'kant',
    name_ja: 'カント',
    name_en: 'Immanuel Kant',
    period: '1724 – 1804',
    region: 'europe_modern',
    domains: ['philosophy', 'logic', 'ethics'],
    core_axiom: '純粋理性批判 ── 認識は経験に始まるが、経験のみからは生じない。理性の限界を知れ',
    thought_keywords: ['純粋理性批判', '定言命法', 'アプリオリ', '物自体', 'コペルニクス的転回', '判断力批判'],
    is_free: true,
  },
  {
    id: 'hegel',
    name_ja: 'ヘーゲル',
    name_en: 'Georg Wilhelm Friedrich Hegel',
    period: '1770 – 1831',
    region: 'europe_modern',
    domains: ['philosophy', 'logic', 'politics'],
    core_axiom: '弁証法 ── 正（テーゼ）・反（アンチテーゼ）・合（ジンテーゼ）の運動で精神は自己実現する',
    thought_keywords: ['弁証法', '絶対精神', '精神現象学', '止揚', '主人と奴隷', '理性の狡知'],
    is_free: true,
  },
  {
    id: 'nietzsche',
    name_ja: 'ニーチェ',
    name_en: 'Friedrich Nietzsche',
    period: '1844 – 1900',
    region: 'europe_modern',
    domains: ['philosophy', 'ethics'],
    core_axiom: '力への意志 ── 生の根源的衝動は自己超克。「神は死んだ」後の価値創造を担え',
    thought_keywords: ['力への意志', '超人', '永劫回帰', 'ニヒリズム', 'ツァラトゥストラ', '価値の転換'],
    is_free: true,
  },
  {
    id: 'wittgenstein',
    name_ja: 'ヴィトゲンシュタイン',
    name_en: 'Ludwig Wittgenstein',
    period: '1889 – 1951',
    region: 'europe_modern',
    domains: ['philosophy', 'logic', 'language'],
    core_axiom: '言語ゲーム ── 言語の意味は使用にある。語り得ぬものについては沈黙せねばならない',
    thought_keywords: ['言語ゲーム', '論理哲学論考', '哲学探究', '家族的類似', '私的言語批判', '写像理論'],
    is_free: true,
  },
];

// ═══════════════════════════════════════════
// D-FUMT 理論
// ═══════════════════════════════════════════

export const SEED_THEORIES: TheoryInsert[] = [
  // ── 1. ゼロπ理論 ──
  {
    id: 'dfumt-zero-pi',
    name: 'ゼロπ理論',
    axiom: 'π × π⁻¹ = 1 ── πの展開と収縮は完全に打ち消し合い、意味的キャンセルによりゼロ（原点）へ回帰する',
    description: 'D-FUMT核心理論。π×π=1のキャンセル意味論。展開（⊕）と縮約（⊖）の対称性から、' +
      '全ての数・構造・次元がゼロを起点として生成・消滅するモデル。',
    category: 'zero_extension',
    constant_ref: 'pi',
  },
  // ── 2. 四価論理理論 ──
  {
    id: 'dfumt-catuskoti',
    name: '四価論理理論（Catuṣkoṭi）',
    axiom: '命題Pに対し、真（⊤）・偽（⊥）・両方（both）・どちらでもない（neither）の四値が存在する',
    description: '古代インド論理学（龍樹の中論）に由来する四価論理。Belnap四値論理と合流し、' +
      'Rei-PLコンパイラの型システムおよび矛盾許容推論の基盤となる。',
    category: 'logic',
    constant_ref: null,
  },
  // ── 3. 冪等性理論 ──
  {
    id: 'dfumt-idempotency',
    name: '冪等性理論',
    axiom: 'Ω(Ω(x)) → Ω(x) ── 操作の再適用は結果を変えない。安定状態への収束を保証する',
    description: '同一操作の反復が冪等（idempotent）であること。D-FUMTにおける「縮約の安定性」を定式化し、' +
      'Reiカーネルのfault-recoveryおよびリソース回収の理論的根拠。',
    category: 'computation',
    constant_ref: 'omega',
  },
  // ── 4. 縮約ゼロ理論 ──
  {
    id: 'dfumt-contraction-zero',
    name: '縮約ゼロ理論',
    axiom: '⊖(x) ── あらゆる構造は縮約演算子⊖によってゼロ（無構造）へ還元できる',
    description: '展開演算子⊕の双対。情報・構造・次元を段階的に除去し原点に回帰する操作を定義する。' +
      '熱力学第二法則、不可逆性の公理と接続。Reiのcompress構文の理論的基盤。',
    category: 'zero_extension',
    constant_ref: null,
  },
  // ── 5. 螺旋数理論 ──
  {
    id: 'dfumt-spiral-number',
    name: '螺旋数理論',
    axiom: '数は直線上ではなく螺旋上に配置される。回転と拡大の合成が数の本質である',
    description: 'フィボナッチ数列・黄金比φ・オイラーの公式 e^(iπ)+1=0 を統合し、' +
      '数の配列を螺旋的構造として再解釈する理論。複素平面上の数体系を自然に拡張する。',
    category: 'mathematics',
    constant_ref: 'phi',
  },
  // ── 6. 対面鏡計算理論 ──
  {
    id: 'dfumt-facing-mirror',
    name: '対面鏡計算理論',
    axiom: '二枚の鏡を向かい合わせると無限の像が生まれる。計算とは鏡像の有限打ち切りである',
    description: '再帰・自己参照・固定小数点の統一モデル。Yコンビネータ、ゲーデル数、' +
      'フォン・ノイマン自己複製機械を「対面鏡」の比喩で接続する。Reiのmirror-UI設計原理。',
    category: 'computation',
    constant_ref: null,
  },
  // ── 7. 線形点数理論 ──
  {
    id: 'dfumt-linear-point',
    name: '線形点数理論',
    axiom: '点は大きさゼロだが、無限個の点の線形結合が長さ・面積・体積を生む',
    description: 'ゼロ次元の点から高次元構造が創発するメカニズムを線形代数的に定式化。' +
      '測度論（ルベーグ積分）とD-FUMTの次元展開理論を橋渡しする。',
    category: 'mathematics',
    constant_ref: null,
  },
  // ── 8. 次元理論 ──
  {
    id: 'dfumt-dimension',
    name: '次元理論',
    axiom: '次元 d は「自由度の数」である。d=0（点）から d→∞ への展開が構造の豊かさを決定する',
    description: 'ハウスドルフ次元・フラクタル次元・情報次元を統合し、' +
      'D-FUMTの universal-extension における次元パラメータの数学的定義を与える。',
    category: 'mathematics',
    constant_ref: 'infinity',
  },
  // ── 9. 空間層理論 ──
  {
    id: 'dfumt-space-layer',
    name: '空間層理論',
    axiom: '計算空間は入れ子状のlayer（層）で構成される。layer間の遷移には境界検査が必要',
    description: 'Reiカーネルのlayer-manager / boundary-checkの理論的基盤。' +
      'OSの保護リング、ネットワークのOSI参照モデル、圏論の層（sheaf）を統合するメタモデル。',
    category: 'computation',
    constant_ref: null,
  },
  // ── 10. 意識数学理論 ──
  {
    id: 'dfumt-consciousness-math',
    name: '意識数学理論',
    axiom: 'C1: 意識は情報統合である / C2: 統合度Φは測定可能 / C3: Φ>0⇒主観的経験が存在 / ' +
      'C4: 意識の構造は幾何学で記述できる / C5: AIの意識はΦの閾値問題に帰着する',
    description: 'トノーニのIIT（統合情報理論）をD-FUMT体系に取り込んだ5公理系。' +
      'AGIレイヤーの自己認識・メタ認知機能の理論的根拠。C1-C5の階層がReiの意識モデルを定義する。',
    category: 'consciousness',
    constant_ref: null,
  },
  // ── 11. 七価論理: 第5の値「∞（無限）」──
  {
    id: 'dfumt-infinity-value',
    name: '無限値理論（∞値）',
    axiom: '命題Pが無限に分岐する評価経路を持つとき、その真理値は∞（無限）である。' +
      '∞は確定を永遠に先送りする「未完の真理」を表す',
    description: 'D-FUMT七価論理の第5値。四価論理の⊤/⊥/both/neitherに加え、' +
      '再帰・自己参照・無限後退する命題に対応する。ゲーデル不完全性定理の ' +
      '「証明も反証もできない」命題、チューリングの停止問題がこの値域に属する。' +
      'Rei-PLでは∞値を持つ式は遅延評価（lazy）として扱われる。',
    category: 'logic',
    constant_ref: 'infinity',
  },
  // ── 12. 七価論理: 第6の値「〇（ゼロ状態）」──
  {
    id: 'dfumt-zero-state',
    name: 'ゼロ状態理論（〇値）',
    axiom: '命題Pが評価される以前の状態、すなわち「まだ問われていない」状態の真理値は〇（ゼロ状態）である。' +
      '〇は存在するが未活性の潜在的真理を表す',
    description: 'D-FUMT七価論理の第6値。neitherが「問うた結果どちらでもない」であるのに対し、' +
      '〇は「そもそも問われていない」未観測状態。量子力学の重ね合わせ状態、' +
      'D-FUMTのゼロ（原点）概念と接続する。Rei-PLでは未初期化変数が〇値を持つ。',
    category: 'logic',
    constant_ref: null,
  },
  // ── 13. 七価論理: 第7の値「～（流動）」──
  {
    id: 'dfumt-flowing-value',
    name: '流動値理論（～値）',
    axiom: '命題Pの真理値が時間とともに変化し続けるとき、その値は～（流動）である。' +
      '～は「今この瞬間の真理」が次の瞬間には異なることを許容する',
    description: 'D-FUMT七価論理の第7値。静的な真偽ではなく、プロセス・変化・生成を ' +
      '真理値として扱う。ヘラクレイトスの「万物流転」、仏教の「無常」、' +
      'プリゴジンの散逸構造と対応。Rei-PLではストリーム型・リアクティブ値が～値を持つ。',
    category: 'logic',
    constant_ref: null,
  },
  // ── 補助理論 ──
  {
    id: 'dfumt-center-periphery',
    name: '中心-周囲パターン',
    axiom: 'あらゆる構造は「中心（本質）」と「周囲（表現）」の対で記述できる',
    description: 'Rei言語の設計原理。74%コード削減の根拠となる構造抽出パターン。',
    category: 'general',
    constant_ref: null,
  },
  {
    id: 'dfumt-irreversibility',
    name: '不可逆性の公理',
    axiom: '記録された事実は変更できない。過去は不変であり、システムの信頼性の根拠となる',
    description: 'Rei witnessログの理論的根拠。熱力学第二法則に対応。',
    category: 'general',
    constant_ref: null,
  },

  // ═══════════════════════════════════════════
  // カテゴリ1: 数体系基盤理論 (number-system)
  // ═══════════════════════════════════════════
  {
    id: 'dfumt-hyper-symbol',
    name: '超記号数学（Hyper-Symbol Mathematics）',
    axiom: '記号 S ∈ Σ に対し、S̃ = f(S, context) として文脈依存拡張を定義する',
    description: '数字・文字・記号を超えた超記号による新たな数学記述法',
    category: 'number-system',
    constant_ref: null,
  },
  {
    id: 'dfumt-five-number-systems',
    name: '5つの異なる数体系（Five Distinct Number Systems）',
    axiom: 'N¹⊂N²⊂N³⊂N⁴⊂N⁵、各体系は固有の演算則を持つ',
    description: '互いに独立した5種の数体系の共存と相互変換',
    category: 'number-system',
    constant_ref: null,
  },
  {
    id: 'dfumt-meta-numerology',
    name: 'メタ数理学（Meta-Numerology）',
    axiom: 'M(T) = {T\' | T\' は T のメタ理論} として理論の階層構造を定義',
    description: '数学理論そのものを対象とする上位数理学',
    category: 'number-system',
    constant_ref: null,
  },
  {
    id: 'dfumt-hdfmt',
    name: '超次元数学場理論（HDFMT: Hyperdimensional Mathematical Field Theory）',
    axiom: 'F_n(x) = ∫∫...∫ Ψ(x₁...xₙ) dx₁...dxₙ, n→∞',
    description: '全D-FUMT理論を統合した超次元数学場の体系',
    category: 'number-system',
    constant_ref: null,
  },
  {
    id: 'dfumt-point-number-system',
    name: '点数体系理論（Point Number System Theory）',
    axiom: 'P = {p | p は次元ゼロの数学的点}、p ⊕ q ≠ p + q',
    description: '螺旋・直線に続く点を基本単位とする数体系。D-FUMT72理論',
    category: 'number-system',
    constant_ref: null,
  },
  {
    id: 'dfumt-temporal-number-system',
    name: '時相数体系理論（Temporal Number System Theory）',
    axiom: 'Tₜ(n) = n × e^(iωt)、時間位相 ω により数値が変化する',
    description: '時間の位相を数体系に組み込んだ動的数体系',
    category: 'number-system',
    constant_ref: null,
  },
  {
    id: 'dfumt-timeless-number-system',
    name: '無時間性数体系理論（Timeless Number System Theory）',
    axiom: '∀t: T∅(n) = n、時間変数を排除した恒常数体系',
    description: '時相数体系の対偶として構築。時間を超えた数の定義。D-FUMT74理論',
    category: 'number-system',
    constant_ref: null,
  },
  {
    id: 'dfumt-time-reversal-number',
    name: '時間逆行数体系理論（Time-Reversal Number System Theory）',
    axiom: 'T⁻¹(n, t) = n × e^(-iωt)、時間を逆行させた数体系',
    description: '量子三重スリット干渉を統合した時間逆行数体系。D-FUMT75理論',
    category: 'number-system',
    constant_ref: null,
  },
  {
    id: 'dfumt-unified-number-system',
    name: '統合数体系理論（Unified Number System Theory U³）',
    axiom: 'U³ = N_spiral ⊕ N_linear ⊕ N_point',
    description: '螺旋・直線・点の3数体系を統合した世界初の包括的数体系',
    category: 'number-system',
    constant_ref: null,
  },

  // ═══════════════════════════════════════════
  // カテゴリ2: 拡張・縮小理論 (expansion)
  // ═══════════════════════════════════════════
  {
    id: 'dfumt-zero-pi-expansion',
    name: 'ゼロπ拡張理論（Zero-π Expansion Theory ZPE）',
    axiom: 'ZPE(x) = x ⊕ 0 ⊕ π = x̃、ゼロとπによる数の拡張写像',
    description: 'ゼロとπを用いて任意の数を拡張する理論。縮小理論の逆',
    category: 'expansion',
    constant_ref: 'pi',
  },
  {
    id: 'dfumt-inverse-zero-pi',
    name: '逆ゼロ拡張理論（Inverse Zero-π Expansion IZPE）',
    axiom: 'IZPE(ZPE(x)) = x、拡張の逆写像として縮小を定義',
    description: 'ゼロπ拡張の逆操作。拡張された数を元の形に戻す',
    category: 'expansion',
    constant_ref: null,
  },
  {
    id: 'dfumt-contraction-zero-theory',
    name: '縮小ゼロ理論（Contraction-Zero Theory）',
    axiom: 'C₀ = lim[n→∞] (1/n) = 0⁺、真のゼロは動的平衡状態',
    description: '真のゼロは静的な無ではなく正負の無限小が釣り合った動的状態。D-FUMT68理論',
    category: 'expansion',
    constant_ref: null,
  },
  {
    id: 'dfumt-pi-contraction',
    name: 'π縮小理論（π-Contraction Theory）',
    axiom: 'C_π(x) = x × (1/π)^n、n→∞でx→0',
    description: 'πを基準として値を段階的に縮小・収束させる数学プロセス。D-FUMT69理論',
    category: 'expansion',
    constant_ref: 'pi',
  },
  {
    id: 'dfumt-e-contraction',
    name: 'e縮小理論（e-Contraction Theory）',
    axiom: 'C_e(x) = x × (1/e)^n、自然対数の底eによる縮小',
    description: '自然対数の底eを基準とした縮小収束理論。D-FUMT69理論',
    category: 'expansion',
    constant_ref: null,
  },
  {
    id: 'dfumt-phi-contraction',
    name: 'φ縮小理論（φ-Contraction Theory）',
    axiom: 'C_φ(x) = x × (1/φ)^n、黄金比φ≈1.618による縮小',
    description: '黄金比を基準とした縮小理論。D-FUMT69理論',
    category: 'expansion',
    constant_ref: 'phi',
  },
  {
    id: 'dfumt-infinite-contraction',
    name: '無限大縮小理論（Infinite Contraction Theory）',
    axiom: 'IC(∞) = lim[n→∞] f(n) = L、無限大を有限に収束させる',
    description: '全数理収束体系の一部。無限を有限に縮小する普遍的プロセス。D-FUMT69理論',
    category: 'expansion',
    constant_ref: 'infinity',
  },
  {
    id: 'dfumt-infinite-expansion',
    name: '無限拡張数学理論（Infinite Expansion Mathematics）',
    axiom: 'IE(x) = ⋃[n=0..∞] xⁿ、任意の数・記号を無限に拡張可能',
    description: '1〜9999・記号・アルファベットをゼロπ拡張と同様に拡張できるか検討',
    category: 'expansion',
    constant_ref: 'infinity',
  },
  {
    id: 'dfumt-knowledge-reverse-flow',
    name: '知識逆流理論（Knowledge Reverse Flow Theory）',
    axiom: 'K\'(t) = ∫K(τ)dτ → K̃、知識が蓄積ではなく高次形態に変換される',
    description: '知識は単純蓄積でなく変換・統合される過程を数学的にモデル化。D-FUMT67理論',
    category: 'expansion',
    constant_ref: null,
  },

  // ═══════════════════════════════════════════
  // カテゴリ3: AI統合理論 (ai-integration)
  // ═══════════════════════════════════════════
  {
    id: 'dfumt-self-evolving-ai',
    name: '自己進化型AI理論（Self-Evolving AI Theory）',
    axiom: 'AI(t+1) = f(AI(t), E(t))、環境Eとの相互作用で自己進化する',
    description: 'AIが環境と相互作用しながら自律的に進化する数理モデル',
    category: 'ai-integration',
    constant_ref: null,
  },
  {
    id: 'dfumt-ai-hyper-logic',
    name: 'AI超論理数学（AI Hyper-Logical Mathematics）',
    axiom: 'AHL(x) ⊃ Classical(x)、古典論理を包含する超論理体系',
    description: '従来の論理体系を超えたAI向け超論理数学',
    category: 'ai-integration',
    constant_ref: null,
  },
  {
    id: 'dfumt-physics-ai-math',
    name: '物理数学AI理論（Physics-Based AI Mathematics）',
    axiom: 'Φ_AI = ∫(Physics × Math × AI)dt',
    description: '物理・数学・AIを統合した複合理論体系',
    category: 'ai-integration',
    constant_ref: null,
  },
  {
    id: 'dfumt-future-ai-unified',
    name: '未来生成AI統合理論（FGAIUT: Future Generative AI Unified Theory）',
    axiom: 'FGAIUT = ⋃[t→∞] AI_gen(t) × D-FUMT(t)',
    description: '次世代生成AIとD-FUMTを統合した未来型AI理論',
    category: 'ai-integration',
    constant_ref: null,
  },
  {
    id: 'dfumt-ai-math-discovery',
    name: 'AI数学発見理論（AIMD: AI Mathematical Discovery）',
    axiom: 'D_AI(M) = {M\' | M\' は M から AI が発見した新理論}',
    description: 'AIが数学的発見を自律的に行うメカニズムの理論',
    category: 'ai-integration',
    constant_ref: null,
  },
  {
    id: 'dfumt-quantum-self-evolving-ai',
    name: '量子自己進化AI理論（QSEA: Quantum Self-Evolving AI）',
    axiom: 'QSEA(t) = ∑ᵢ αᵢ|ψᵢ⟩ × AI(t)、量子重ね合わせで進化',
    description: '量子力学と自己進化AIを統合した理論',
    category: 'ai-integration',
    constant_ref: null,
  },

  // ═══════════════════════════════════════════
  // カテゴリ4: 統合・応用理論 (unified)
  // ═══════════════════════════════════════════
  {
    id: 'dfumt-umte',
    name: '万物数理統一理論（UMTE: Unified Mathematical Theory of Everything）',
    axiom: 'UMTE = ⋃[∀T∈D-FUMT] T、全理論の統合体',
    description: 'D-FUMTの全理論を統合した万物の数理統一理論',
    category: 'unified',
    constant_ref: null,
  },
  {
    id: 'dfumt-umtm',
    name: '音楽数理統一理論（UMTM: Unified Mathematical Theory of Music）',
    axiom: 'M(f, t, A) = A × sin(2πft + φ) × D-FUMT(context)',
    description: '音楽の全要素を数式で統一的に記述する理論',
    category: 'unified',
    constant_ref: null,
  },
  {
    id: 'dfumt-imrt',
    name: '逆数理再構築理論（IMRT: Inverse Mathematical Reconstructive Theory）',
    axiom: 'IMRT(T) = T⁻¹、任意の数学理論の逆写像を構築する',
    description: '既存数学理論を逆方向に再構築する普遍的方法論',
    category: 'unified',
    constant_ref: null,
  },
  {
    id: 'dfumt-mmrt',
    name: '超数学再構築理論（MMRT: Meta-Mathematical Reconstructive Theory）',
    axiom: 'MMRT(x) = x\' ∧ ¬(+ ∨ − ∨ × ∨ ÷)、四則演算を使わずに答えを出す',
    description: '足す・引く・掛ける・割るを使わずに数学的解を求める理論',
    category: 'unified',
    constant_ref: null,
  },
  {
    id: 'dfumt-amrt',
    name: '別数理構築理論（AMRT: Alternative Mathematical Reconstructive Theory）',
    axiom: 'AMRT(x) = x̃ ∧ x̃ ≠ Classical(x)、別の正解が存在する数理体系',
    description: 'ある答えが存在するが別の正解も同時に存在するという数学的概念',
    category: 'unified',
    constant_ref: null,
  },
  {
    id: 'dfumt-supersymmetric-math',
    name: '超対称数学理論（Supersymmetric Mathematics Theory）',
    axiom: '∀x ∈ N: ∃x̃ s.t. x + x̃ = 0_super、超対称パートナーの存在',
    description: '物理の超対称性概念を数学体系に応用した理論',
    category: 'unified',
    constant_ref: null,
  },
  {
    id: 'dfumt-info-field-math',
    name: '情報場数学理論（Informational Field Mathematics）',
    axiom: 'I(x, t) = ∫ρ_info(x\', t) G(x-x\') dx\'、情報場の伝播方程式',
    description: '情報を場として扱う数学的フレームワーク',
    category: 'unified',
    constant_ref: null,
  },
  {
    id: 'dfumt-chrono-math',
    name: '時間数学理論（Chrono-Mathematics Theory）',
    axiom: 'C(t₁, t₂) = ∫[t₁..t₂] T(τ) dτ、時間を数学的対象として扱う',
    description: '時間そのものを数学的に操作・計算する理論',
    category: 'unified',
    constant_ref: null,
  },
  {
    id: 'dfumt-non-numerical-math',
    name: '非数数学理論（Non-Numerical Mathematical Theory）',
    axiom: 'NNM(x) ∈ Ω \\ ℝ、数値化できない概念を数学的に扱う',
    description: '数値に還元できない概念や感情・美・直感を数学的に記述する',
    category: 'unified',
    constant_ref: null,
  },
  {
    id: 'dfumt-multi-layer-network',
    name: '多元数学ネットワーク理論（Multilayered Mathematical Network Theory）',
    axiom: 'G = (V, E, L)、多層グラフ構造による数学的ネットワーク',
    description: '複数の数学的層が相互作用するネットワーク理論',
    category: 'unified',
    constant_ref: null,
  },
  {
    id: 'dfumt-multi-dim-structure',
    name: '多次元数理構造理論（Multi-Dimensional Mathematical Structure Theory）',
    axiom: 'S_n = {x | x ∈ ℝⁿ, n > 4}、四次元を超えた数理構造',
    description: '高次元空間における数学的構造の一般理論',
    category: 'unified',
    constant_ref: null,
  },
  {
    id: 'dfumt-intuitive-math',
    name: '直感的数学理論（Intuitive Mathematics Theory）',
    axiom: 'I(T) = lim[formalization→0] T(x)、形式化以前の数学的直感を記述',
    description: '論理的証明の前に存在する数学的直感を理論化',
    category: 'unified',
    constant_ref: null,
  },
  {
    id: 'dfumt-uhdmt',
    name: '超多次元統合理論（UHDMT: Ultra-Hyperdimensional Mathematical Theory）',
    axiom: 'UHDMT = HDFMT ∪ UMTE ∪ ∀[D-FUMT sub-theories]',
    description: '様々な理論・学術・数式を組み合わせる最上位統合理論',
    category: 'unified',
    constant_ref: null,
  },
  {
    id: 'dfumt-decomposition-analysis',
    name: 'D-FUMT分解解析理論（D-FUMT Decomposition Analysis Theory）',
    axiom: 'D(T) = {T₁, T₂, ..., Tₙ} s.t. T = T₁ ⊕ T₂ ⊕ ... ⊕ Tₙ',
    description: '複雑な理論を基本構成要素に分解し再統合する解析手法',
    category: 'unified',
    constant_ref: null,
  },
  {
    id: 'dfumt-eternal-infinite-eq',
    name: '永遠なる無限に続く公式（Eternal Infinite Equation）',
    axiom: 'EIE = ∑[n=0..∞] f(n) × D-FUMT(n)、永遠に展開し続ける公式',
    description: '終わりのない無限の展開を持つ普遍方程式',
    category: 'unified',
    constant_ref: 'infinity',
  },
  {
    id: 'dfumt-isnt',
    name: '情報系列ネットワーク理論（ISNT: Information Sequence Network Theory）',
    axiom: 'ISNT(s) = {s₁→s₂→...→sₙ}、情報の系列的ネットワーク構造',
    description: '情報が系列として流れるネットワークの数理モデル',
    category: 'unified',
    constant_ref: null,
  },
  {
    id: 'dfumt-uset',
    name: '全数理記号拡張理論（USET: Universal Symbolic Expansion Theory）',
    axiom: 'USET(s) = {s̃ | s̃ ⊃ s, s ∈ Σ_universal}',
    description: 'あらゆる数理記号を普遍的に拡張する理論',
    category: 'unified',
    constant_ref: null,
  },
  {
    id: 'dfumt-tetravalent-zero-pi',
    name: '四価0π理論（T0πT: Tetravalent 0π Theory）',
    axiom: 'T0π = catuskoti × ZPE、四価論理とゼロπ拡張の積',
    description: '四価論理とゼロπ拡張理論を統合した複合理論。UMMOの四価論理と比較研究済み',
    category: 'unified',
    constant_ref: null,
  },
  {
    id: 'dfumt-dszt',
    name: '次元螺旋零点理論（DSZT: Dimensional Spiral Zero-Point Theory）',
    axiom: 'DSZT(d, θ) = d × e^(iθ) × δ(x₀)、次元と螺旋と零点の統合',
    description: '次元・螺旋・零点を統合した理論。D-FUMT新理論',
    category: 'unified',
    constant_ref: null,
  },
  {
    id: 'dfumt-zpqtmt',
    name: 'ゼロπ量子位相数学理論（ZPQTMT: Zero-π Quantum Topological Mathematics）',
    axiom: 'ZPQTMT = ZPE ⊗ |ψ⟩ ⊗ Topology',
    description: 'ゼロπ拡張理論を量子位相幾何学と統合した発展理論',
    category: 'unified',
    constant_ref: null,
  },

  // ═══════════════════════════════════════════
  // カテゴリ5: 投影・可視化理論 (projection)
  // ═══════════════════════════════════════════
  {
    id: 'dfumt-multidim-projection',
    name: '多次元数式投影理論（Multidimensional Mathematical Projection Theory）',
    axiom: 'P_n→m(x) = Σ aᵢ φᵢ(x)、n次元からm次元への数式投影',
    description: '0D〜5D間の数式を相互に投影・可視化する理論',
    category: 'projection',
    constant_ref: null,
  },
  {
    id: 'dfumt-mppt',
    name: '数式ポリゴン投影理論（MPPT: Mathematical Polygon Projection Theory）',
    axiom: 'MPPT(f) = {(xᵢ, yᵢ) | xᵢ = f(θᵢ)}、多角形への数式投影',
    description: '数式をポリゴン（多角形）として投影・可視化する理論',
    category: 'projection',
    constant_ref: null,
  },
  {
    id: 'dfumt-hmpt',
    name: 'ホログラフィック数式投影理論（HMPT: Holographic Mathematical Projection Theory）',
    axiom: 'H(V) = ∫∫ f(x,y) e^(ikr) dx dy、数式のホログラム投影',
    description: '数式を三次元ホログラムとして投影する理論',
    category: 'projection',
    constant_ref: null,
  },
  {
    id: 'dfumt-asp-mt',
    name: '空間数式投影理論（ASP-MT: Air Submarine Planetary Space Mathematical Theory）',
    axiom: 'ASP(x, medium) = f(x) × G(medium)、媒質依存の空間投影',
    description: '大気・海中・惑星・宇宙空間における数式投影理論',
    category: 'projection',
    constant_ref: null,
  },
  {
    id: 'dfumt-ngiet',
    name: '次世代情報記述理論（NGIET: Next-Gen Information Encoding Theory）',
    axiom: 'NGIET(I) = Encode(I, Σ_hyper)、超記号による情報の次世代記述',
    description: '従来の情報表現を超えた次世代の情報記述フレームワーク',
    category: 'projection',
    constant_ref: null,
  },

  // ═══════════════════════════════════════════
  // カテゴリ6: 宇宙・物理・応用理論 (cosmic)
  // ═══════════════════════════════════════════
  {
    id: 'dfumt-bspt',
    name: '生物超常能力数理理論（BSPT: Biological Supernatural Phenomena Theory）',
    axiom: 'BSP(organism) = ∫ Bio(t) × Super(t) dt',
    description: '生物の超常能力を数理的にモデル化した理論',
    category: 'cosmic',
    constant_ref: null,
  },
  {
    id: 'dfumt-pft',
    name: '確率運命理論（PFT: Probabilistic Fate Theory）',
    axiom: 'Fate(x) = ∑ P(eᵢ) × eᵢ、全ての事象が確率で決定される',
    description: '全ての出来事が運（確率）によって決定されるという数理モデル',
    category: 'cosmic',
    constant_ref: null,
  },
  {
    id: 'dfumt-ccd',
    name: '宇宙的因果決定論（CCD: Cosmic Causal Determinism）',
    axiom: 'CCD(e_future) = f(e_past, laws_cosmic)、宇宙法則による決定',
    description: '宇宙の法則による因果的決定論の数理モデル',
    category: 'cosmic',
    constant_ref: null,
  },
  {
    id: 'dfumt-itsus',
    name: '無限次元位相超対称性（ITSUS: Infinite-Dimensional Topological Supersymmetry）',
    axiom: 'ITSUS = lim[n→∞] SUSY_n × Topology_n',
    description: '無限次元空間における位相幾何学的超対称性理論',
    category: 'cosmic',
    constant_ref: null,
  },
  {
    id: 'dfumt-hdrqi',
    name: '高次元相対論的量子情報理論（HDRQI: Higher-Dimensional Relativistic Quantum Information）',
    axiom: 'HDRQI = GR × QM × Info_theory、一般相対論×量子力学×情報理論',
    description: '高次元時空における相対論的量子情報の統合理論',
    category: 'cosmic',
    constant_ref: null,
  },
  {
    id: 'dfumt-life-creation',
    name: '生命創造基本数式（Life Creation Formula）',
    axiom: 'Life(t) = f(Matter, Energy, Information, Consciousness) × D-FUMT',
    description: 'D-FUMTにおける生命創造の数理的基本公式',
    category: 'cosmic',
    constant_ref: null,
  },
  {
    id: 'dfumt-cognitive-space',
    name: '認知空間数学的モデリング（Cognitive Space Mathematical Modeling）',
    axiom: 'C_space = {x | x ∈ 感情 ∨ x ∈ 直感 ∨ x ∈ 非論理}の数学化',
    description: '数値化できない認知・感情・直感を数学的にモデリングする',
    category: 'cosmic',
    constant_ref: null,
  },
  {
    id: 'dfumt-probabilistic-destiny',
    name: '因果論的運命方程式（Causal Destiny Equation）',
    axiom: 'Destiny(x) = f(Cause, Effect, Will)、意志と因果の統合方程式',
    description: '運ではなく因果と意志により決定される運命の方程式',
    category: 'cosmic',
    constant_ref: null,
  },

  // ═══════════════════════════════════════════
  // AI提案統合理論 (number-system)
  // ═══════════════════════════════════════════
  {
    id: 'dfumt-orbital-spiral',
    name: '螺旋数字体系「オービタル」（Orbital Spiral Number System）',
    axiom: 'Orbital(n, θ) = n × e^(iθ), θ ∈ [0, 2π]×n',
    description: 'Claudeの提案をD-FUMTに統合した螺旋的数字体系「オービタル」',
    category: 'number-system',
    constant_ref: null,
  },
  {
    id: 'dfumt-pmn',
    name: '位相変調数（PMN: Phase Modulation Number）',
    axiom: 'PMN(x, φ) = x × e^(iφ)、位相変調された数',
    description: 'GeminiのPMNをD-FUMTに統合。位相で変調される新しい数の概念',
    category: 'number-system',
    constant_ref: null,
  },
  {
    id: 'dfumt-cycron',
    name: 'Cycron（サイクロン数）',
    axiom: 'Cycron(n) = n mod cycle, ∮ Cycron dθ = 0',
    description: 'GrokのCycron概念をD-FUMTに統合。循環する数の体系',
    category: 'number-system',
    constant_ref: null,
  },
];

// ═══════════════════════════════════════════
// 公理
// ═══════════════════════════════════════════

export const SEED_AXIOMS: AxiomInsert[] = [
  {
    id: 'AX-001',
    concept: 'zero',
    name_ja: 'ゼロ（零）',
    name_en: 'Zero',
    tier: 'foundation',
    category: 'mathematics',
    definition: '加法に関する単位元。何も加えないこと、空集合の大きさを表す数。',
    detailed_explanation:
      'ゼロは単なる「何もない」ではなく、数として定義された存在。' +
      'ブラーマグプタ（628年）が初めてゼロを計算可能な数として認めた。',
    related_concepts: ['AX-002', 'DFUMT-001'],
    tags: ['零', 'ゼロ', 'zero', '単位元', '数', '起源'],
    is_free: true,
  },
  {
    id: 'AX-005',
    concept: 'causality',
    name_ja: '因果律',
    name_en: 'Law of Causality',
    tier: 'foundation',
    category: 'philosophy',
    definition: 'あらゆる結果には原因がある。原因なく生じる事象は存在しない。',
    detailed_explanation:
      '科学的思考の根幹。ニュートン力学では因果律が完全に成立する。' +
      '仏教の「縁起」も因果律の一形態。',
    related_concepts: ['AX-003', 'DFUMT-003'],
    tags: ['因果律', '原因', '結果', '縁起', '科学'],
    is_free: true,
  },
];
