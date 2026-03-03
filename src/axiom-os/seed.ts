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
  {
    id: 'dfumt-zero-pi',
    name: '零π延長理論',
    axiom: 'ゼロはπの展開によって全ての数・構造・次元を生み出す起点である',
    description: 'D-FUMT核心理論。宇宙の起源をゼロからの展開として捉えるモデル。',
    category: 'zero_extension',
    constant_ref: 'pi',
  },
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
