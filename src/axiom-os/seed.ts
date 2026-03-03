/**
 * 公理OS — 初期シードデータ
 *
 * 東洋11名 + 西洋9名 = 20人物
 * D-FUMT理論3件、公理2件
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
