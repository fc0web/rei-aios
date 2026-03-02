/**
 * 公理OS — 公理辞書システム (axiom-dictionary.ts)
 *
 * D-FUMTの理論体系と全世界の知識を「公理」として索引化する辞書。
 * 将来的にSQLite FTS（全文検索）への移行も容易な設計。
 *
 * 構造:
 *   AxiomEntry    = 辞書の1エントリ（概念・定義・証明・応用）
 *   AxiomDictionary = エントリの集合と検索エンジン
 *
 * D-FUMT中心-周囲パターン:
 *   中心 = 公理の核心定義
 *   周囲 = 関連理論・講師・図形・数式・応用例
 */

import {
  HistorianPersona,
  HISTORIAN_DB,
  getHistorianById,
} from './historians/historian-personas';

// ─── 型定義 ──────────────────────────────────────────────────────────────────

export type AxiomTier =
  | 'foundation'    // 基礎公理（最も根本的）
  | 'derived'       // 派生公理（基礎から導出）
  | 'applied'       // 応用公理（実践的）
  | 'philosophical'; // 哲学的公理（形而上的）

export type AxiomCategory =
  | 'mathematics'       // 数学
  | 'logic'             // 論理学
  | 'physics'           // 物理学
  | 'consciousness'     // 意識・心
  | 'language'          // 言語・記号
  | 'computation'       // 計算・情報
  | 'philosophy'        // 哲学
  | 'ethics'            // 倫理・道徳
  | 'education'         // 教育・認知
  | 'dfumt';            // D-FUMT固有

export interface FormulaDisplay {
  /** LaTeX形式の数式 */
  latex: string;
  /** 人間が読める説明 */
  description: string;
}

export interface DiagramDisplay {
  /** SVGコンテンツ（文字列） */
  svg?: string;
  /** 図形の説明 */
  description: string;
  /** ASCII図（SVGがない場合のフォールバック） */
  ascii?: string;
}

export interface AxiomEntry {
  /** 一意識別子 (例: "AX-001", "DFUMT-007") */
  id: string;
  /** 概念名（日本語） */
  nameJa: string;
  /** 概念名（英語） */
  nameEn: string;
  /** 公理の階層 */
  tier: AxiomTier;
  /** 分野カテゴリ */
  category: AxiomCategory;
  /** 核心定義（1〜2文） */
  coreDefinition: string;
  /** 詳細説明 */
  detailedExplanation: string;
  /** 数式表示（オプション） */
  formula?: FormulaDisplay;
  /** 図形表示（オプション） */
  diagram?: DiagramDisplay;
  /** 関連公理のIDリスト */
  relatedAxiomIds: string[];
  /** この公理を教えられる歴史人物講師のIDリスト */
  historianIds: string[];
  /** D-FUMT理論との対応（D-FUMT公理の場合） */
  dfumtTheoryRef?: string;
  /** 実世界での応用例 */
  applications: string[];
  /** 検索用タグ */
  tags: string[];
  /** フリー層で閲覧可能か */
  isFree: boolean;
  /** 作成日時 */
  createdAt: string;
}

export interface DictionarySearchResult {
  entry: AxiomEntry;
  /** 検索スコア（0.0 – 1.0） */
  score: number;
  /** マッチしたフィールド */
  matchedFields: string[];
}

export interface DictionaryStats {
  totalEntries: number;
  freeEntries: number;
  byCategory: Record<AxiomCategory, number>;
  byTier: Record<AxiomTier, number>;
}

// ─── 公理エントリーデータ ────────────────────────────────────────────────────

const INITIAL_AXIOM_ENTRIES: AxiomEntry[] = [

  // ── 数学・論理の基礎公理（フリー層） ──────────────────────────────────────

  {
    id: 'AX-001',
    nameJa: 'ゼロ（零）',
    nameEn: 'Zero',
    tier: 'foundation',
    category: 'mathematics',
    coreDefinition: '加法に関する単位元。何も加えないこと、空集合の大きさを表す数。',
    detailedExplanation:
      'ゼロは単なる「何もない」ではなく、数として定義された存在。' +
      'ブラーマグプタ（628年）が初めてゼロを計算可能な数として認めた。' +
      'ゼロがなければ位取り記数法も、デジタルコンピュータも存在しない。' +
      'D-FUMTにおいては「零π延長理論」として、ゼロからの展開が宇宙の起源モデルに対応する。',
    formula: {
      latex: 'a + 0 = a \\quad \\forall a \\in \\mathbb{R}',
      description: 'ゼロの加法的単位元としての性質。aに0を加えてもaは変わらない。',
    },
    diagram: {
      description: '数直線上のゼロ ── 正と負の境界点',
      ascii:
        '  負  ←─────┼─────→  正\n' +
        '  -3  -2  -1  0  +1  +2  +3\n' +
        '              ↑\n' +
        '           ゼロ（起点）',
    },
    relatedAxiomIds: ['AX-002', 'AX-010', 'DFUMT-001'],
    historianIds: ['brahmagupta', 'aristotle'],
    applications: [
      '位取り記数法（10進数・2進数）',
      'デジタルコンピュータの2値論理（0と1）',
      '集合論における空集合',
      '物理学における基準点（原点）',
    ],
    tags: ['零', 'ゼロ', 'zero', '単位元', '数', '起源', 'D-FUMT'],
    isFree: true,
    createdAt: new Date().toISOString(),
  },

  {
    id: 'AX-002',
    nameJa: '無限',
    nameEn: 'Infinity',
    tier: 'foundation',
    category: 'mathematics',
    coreDefinition: '際限なく大きくなる概念。カントールは無限にも「大きさ」の違いがあることを証明した。',
    detailedExplanation:
      '無限は「終わりがない」という直感的概念を超える。' +
      '自然数の無限（可算無限）より実数の無限（非可算無限）の方が「大きい」。' +
      'これはカントールの対角線論法で証明された。' +
      'D-FUMTでは「零π延長」により、ゼロから無限が展開されるモデルを扱う。',
    formula: {
      latex: '|\\mathbb{N}| < |\\mathbb{R}| \\quad (\\aleph_0 < \\mathfrak{c})',
      description: '自然数の濃度（アレフ・ゼロ）より実数の濃度（連続体）の方が大きい。',
    },
    diagram: {
      description: '可算無限と非可算無限の階層',
      ascii:
        '  有限 → 可算無限(ℵ₀) → 非可算無限(ℵ₁) → ...\n' +
        '  {1,2,3,...}        実数全体\n' +
        '  自然数・整数・有理数  ↑\n' +
        '               カントールの対角線論法で証明',
    },
    relatedAxiomIds: ['AX-001', 'AX-003', 'DFUMT-001'],
    historianIds: ['aristotle', 'euclid'],
    applications: [
      '微分・積分（極限の概念）',
      '集合論・位相幾何学',
      '量子力学における無限次元ヒルベルト空間',
    ],
    tags: ['無限', 'infinity', 'カントール', '可算', '非可算', '集合論'],
    isFree: true,
    createdAt: new Date().toISOString(),
  },

  {
    id: 'AX-003',
    nameJa: '同一律',
    nameEn: 'Law of Identity',
    tier: 'foundation',
    category: 'logic',
    coreDefinition: 'あらゆるものはそれ自身と同一である。A は A である。',
    detailedExplanation:
      '論理学の3大法則（同一律・矛盾律・排中律）の一つ。' +
      'これはアリストテレスが体系化した。思考の根本的な前提。' +
      '「私は私である」という自己同一性の基礎。' +
      'コンピュータでは変数の値が代入前後で同一であるという前提に対応する。',
    formula: {
      latex: 'A = A \\quad \\forall A',
      description: 'あらゆるAはAと等しい。自明だが論理体系の基礎。',
    },
    relatedAxiomIds: ['AX-004', 'AX-005'],
    historianIds: ['aristotle', 'descartes'],
    applications: [
      '数学的証明の基礎',
      'プログラミングの等値比較（===）',
      '法律における同一人物の認定',
    ],
    tags: ['同一律', '論理', '公理', 'アリストテレス', 'A=A'],
    isFree: true,
    createdAt: new Date().toISOString(),
  },

  {
    id: 'AX-004',
    nameJa: '矛盾律',
    nameEn: 'Law of Non-contradiction',
    tier: 'foundation',
    category: 'logic',
    coreDefinition: '同一のものが同時に同一の関係においてAであり、かつAでないことはできない。',
    detailedExplanation:
      'アリストテレスが「第一哲学」として位置づけた最も根本的な法則。' +
      '「雨が降っている」かつ「雨が降っていない」は同時に成立しない。' +
      'この法則を否定すると、あらゆる命題が証明可能になる（爆発律）。' +
      '量子力学では一見矛盾律に反するように見える現象があるが、観測条件が異なる。',
    formula: {
      latex: '\\neg(P \\land \\neg P)',
      description: 'PとPの否定が同時に真であることは不可能。',
    },
    relatedAxiomIds: ['AX-003', 'AX-005'],
    historianIds: ['aristotle', 'socrates'],
    applications: [
      'デバッグ（矛盾する仕様の検出）',
      '数学的証明（背理法）',
      '哲学的議論の整合性確認',
    ],
    tags: ['矛盾律', '論理', 'アリストテレス', '排中律', '爆発律'],
    isFree: true,
    createdAt: new Date().toISOString(),
  },

  {
    id: 'AX-005',
    nameJa: '因果律',
    nameEn: 'Law of Causality',
    tier: 'foundation',
    category: 'philosophy',
    coreDefinition: 'あらゆる結果には原因がある。原因なく生じる事象は存在しない。',
    detailedExplanation:
      '科学的思考の根幹。ニュートン力学では因果律が完全に成立する。' +
      '量子力学では確率論的なゆらぎがあるが、「確率分布に従う」という意味での因果は維持される。' +
      '仏教の「縁起」も因果律の一形態。「条件がそろえば結果が生じる」という相互依存関係。' +
      'D-FUMTでは「不可逆性」と組み合わせ、時間の方向性を規定する公理として扱う。',
    relatedAxiomIds: ['AX-003', 'DFUMT-003'],
    historianIds: ['aristotle', 'newton', 'confucius'],
    applications: [
      '科学実験の設計（独立変数と従属変数）',
      '医学における病因特定',
      '法律における責任の帰属',
    ],
    tags: ['因果律', '原因', '結果', '縁起', '仏教', '科学', 'D-FUMT'],
    isFree: true,
    createdAt: new Date().toISOString(),
  },

  // ── 計算・アルゴリズム ────────────────────────────────────────────────────

  {
    id: 'AX-006',
    nameJa: 'アルゴリズム',
    nameEn: 'Algorithm',
    tier: 'applied',
    category: 'computation',
    coreDefinition: '問題を解くための有限のステップからなる明確な手順。',
    detailedExplanation:
      'アル＝フワーリズミー（al-Khwarizmi）の名前がそのまま語源。' +
      '良いアルゴリズムの条件: 有限性・明確性・入出力・実行可能性。' +
      'チューリングマシンはあらゆるアルゴリズムを実行できる抽象機械。' +
      'Rei言語はこの公理を体現し、コードの各ステップを明示的に追跡する。',
    formula: {
      latex: 'T(n) = O(f(n))',
      description: '計算量記法。入力サイズnに対するアルゴリズムの実行時間の上界。',
    },
    diagram: {
      description: 'アルゴリズムの基本構造',
      ascii:
        '  入力\n' +
        '   ↓\n' +
        '  ┌───────────────┐\n' +
        '  │  ステップ1    │\n' +
        '  │  ステップ2    │  ← 有限・明確・実行可能\n' +
        '  │  ステップ3    │\n' +
        '  └───────────────┘\n' +
        '   ↓\n' +
        '  出力',
    },
    relatedAxiomIds: ['AX-007', 'AX-008'],
    historianIds: ['al_khwarizmi', 'turing'],
    applications: [
      'コンピュータプログラム',
      '料理レシピ（手順の明確化）',
      '数学的証明の構造',
    ],
    tags: ['アルゴリズム', 'algorithm', '手順', 'チューリング', 'Rei', '計算'],
    isFree: true,
    createdAt: new Date().toISOString(),
  },

  {
    id: 'AX-007',
    nameJa: '計算可能性',
    nameEn: 'Computability',
    tier: 'derived',
    category: 'computation',
    coreDefinition: 'チューリングマシンで解ける問題は計算可能。解けない問題（停止問題など）は存在する。',
    detailedExplanation:
      'チューリングが1936年に証明。全ての問題がコンピュータで解けるわけではない。' +
      '停止問題（あるプログラムが停止するか否かを一般的に判定する問題）は計算不可能。' +
      '「AIはいつか何でも答えられるようになるか？」という問いへの数学的な回答。' +
      'Rei言語の設計でも「計算可能な範囲での厳密な実行」という哲学に対応する。',
    formula: {
      latex: '\\exists L: L \\notin \\text{Decidable}',
      description: '決定不可能な言語（問題）が存在することの証明（チューリング, 1936）。',
    },
    relatedAxiomIds: ['AX-006'],
    historianIds: ['turing', 'al_khwarizmi'],
    applications: [
      'プログラムの停止性検証の限界',
      'AI・機械学習の理論的限界の理解',
      '暗号理論（一方向関数）',
    ],
    tags: ['計算可能性', 'チューリング', '停止問題', 'AI', '限界', '不可能'],
    isFree: false,
    createdAt: new Date().toISOString(),
  },

  // ── D-FUMT 固有公理 ────────────────────────────────────────────────────────

  {
    id: 'DFUMT-001',
    nameJa: '零π延長理論',
    nameEn: 'Zero-Pi Expansion Theory',
    tier: 'foundation',
    category: 'dfumt',
    coreDefinition: 'ゼロはπの展開によって全ての数・構造・次元を生み出す起点である。',
    detailedExplanation:
      'D-FUMT（藤本汎用数学理論）の核心公理の一つ。' +
      '宇宙の起源をゼロからの展開として捉えるモデル。' +
      'πは円周率であると同時に「展開のパラメータ」として機能する。' +
      'ゼロ（何もない）からπによる展開で有・無が同時に生成されるという構造は、' +
      '仏教の「空（くう）」から「色（しき）」への展開とも対応する。',
    formula: {
      latex: '0 \\xrightarrow{\\pi} \\{-\\infty, ..., -1, 0, 1, ..., +\\infty\\}',
      description: 'ゼロからπの展開により全数系が生成される（零π延長）。',
    },
    diagram: {
      description: '零π延長のD-FUMTモデル',
      ascii:
        '         π展開\n' +
        '    0 ───────────→ +∞\n' +
        '    │\n' +
        '    └──────────→ -∞\n' +
        '\n' +
        '  中心: ゼロ（起点・空）\n' +
        '  周囲: 全数系（正・負・複素・超限数）',
    },
    relatedAxiomIds: ['AX-001', 'AX-002', 'DFUMT-002'],
    historianIds: ['brahmagupta', 'seki_takakazu'],
    dfumtTheoryRef: 'D-FUMT Category A – Theory 1',
    applications: [
      '宇宙の起源モデル（ビッグバンの数学的記述）',
      '仏教哲学の数学的形式化（空→色）',
      '計算機における0と1の対称性',
    ],
    tags: ['零π延長', 'D-FUMT', 'ゼロ', '展開', '宇宙', '空', '起源', '藤本'],
    isFree: true,
    createdAt: new Date().toISOString(),
  },

  {
    id: 'DFUMT-002',
    nameJa: '中心-周囲パターン',
    nameEn: 'Center-Periphery Pattern',
    tier: 'foundation',
    category: 'dfumt',
    coreDefinition: 'あらゆる構造は「中心（本質）」と「周囲（表現）」の対で記述できる。',
    detailedExplanation:
      'Rei言語の設計原理であり、D-FUMTの計算モデルの根幹。' +
      '中心: その存在の本質・核心・最も変化しにくい部分。' +
      '周囲: 中心から派生する表現・関係・文脈依存の部分。' +
      '例: 円（中心=中心点、周囲=円周）、人間（中心=意識・自己、周囲=身体・社会的役割）。' +
      'Reiの74%平均コード削減はこのパターンによる本質的な構造抽出から生まれる。',
    diagram: {
      description: '中心-周囲パターンの汎用図',
      ascii:
        '         周囲（表現・文脈）\n' +
        '    ┌────────────────────┐\n' +
        '    │    ┌──────────┐    │\n' +
        '    │    │  中心    │    │\n' +
        '    │    │（本質）  │    │\n' +
        '    │    └──────────┘    │\n' +
        '    └────────────────────┘\n' +
        '\n' +
        '  中心→周囲の放射で構造が生成される',
    },
    relatedAxiomIds: ['DFUMT-001', 'DFUMT-003'],
    historianIds: ['aristotle', 'confucius'],
    dfumtTheoryRef: 'D-FUMT – Rei言語設計原理',
    applications: [
      'Rei言語のコード構造（74%削減の根拠）',
      '画像認識カーネル処理',
      '組織設計（中核事業と周辺事業）',
      '数学：群論の単位元と生成元',
    ],
    tags: ['中心-周囲', 'D-FUMT', 'Rei', 'カーネル', 'パターン', '構造'],
    isFree: true,
    createdAt: new Date().toISOString(),
  },

  {
    id: 'DFUMT-003',
    nameJa: '不可逆性の公理',
    nameEn: 'Axiom of Irreversibility',
    tier: 'derived',
    category: 'dfumt',
    coreDefinition: '記録された事実は変更できない。過去は不変であり、それがシステムの信頼性の根拠となる。',
    detailedExplanation:
      'Rei言語の「witness（証人）」ログシステムの理論的根拠。' +
      '物理学でいう熱力学第二法則（エントロピーの増大・時間の不可逆性）に対応。' +
      'ブロックチェーンの不変性もこの公理の応用。' +
      'D-FUMTでは「宇宙図書館（全記録性）」の哲学と対応する。' +
      '「起きたことは起きた。その記録こそが因果の証明となる」。',
    relatedAxiomIds: ['AX-005', 'DFUMT-002'],
    historianIds: ['newton', 'yoshida_shoin'],
    dfumtTheoryRef: 'D-FUMT – 宇宙図書館理論',
    applications: [
      'Rei witnessログ（実行履歴の不変記録）',
      'ブロックチェーン',
      '法廷証拠の不変性',
      '科学実験の再現性',
    ],
    tags: ['不可逆性', 'D-FUMT', 'witness', 'ログ', '時間', 'ブロックチェーン', '宇宙図書館'],
    isFree: false,
    createdAt: new Date().toISOString(),
  },

  // ── 意識・教育 ────────────────────────────────────────────────────────────

  {
    id: 'AX-008',
    nameJa: '知行合一',
    nameEn: 'Unity of Knowledge and Action',
    tier: 'philosophical',
    category: 'education',
    coreDefinition: '真の知識は行動を伴う。知っていて実行しないのは、まだ知っていないのと同じ。',
    detailedExplanation:
      '王陽明（明代中国の哲学者）が体系化し、吉田松陰が実践した概念。' +
      '「学んだことはすぐ試せ」という公理OSの学習哲学の基礎。' +
      'ジョン・デューイの「経験主義教育（Learning by Doing）」とも対応。' +
      'プログラミング教育では「コードを書きながら覚える」が同じ原理。',
    relatedAxiomIds: ['AX-005', 'AX-009'],
    historianIds: ['yoshida_shoin', 'confucius', 'socrates'],
    applications: [
      '公理OSでの「学んだ公理をすぐ問題に適用」',
      'プロジェクトベース学習',
      '職人の徒弟制度',
    ],
    tags: ['知行合一', '王陽明', '吉田松陰', '学習', '実践', '教育'],
    isFree: true,
    createdAt: new Date().toISOString(),
  },

  {
    id: 'AX-009',
    nameJa: 'ソクラテス式問答法',
    nameEn: 'Socratic Method',
    tier: 'applied',
    category: 'education',
    coreDefinition: '問いを重ねることで、相手が自ら答えに気づくよう導く対話の技法。',
    detailedExplanation:
      'ソクラテスが実践した教育法。「答えを与えない」という逆説的な教え方。' +
      '相手が既に知識を内包しているという前提（産婆術・マイエウティケー）。' +
      '公理OSの「歴史人物が直接答えを与えず問いを返す」モードのモデル。' +
      'AIチャットとの根本的な違い: 「正解を出す」ではなく「思考を促す」。',
    relatedAxiomIds: ['AX-008', 'AX-003'],
    historianIds: ['socrates', 'yoshida_shoin'],
    applications: [
      '公理OSの対話モード',
      'コーチング・メンタリング',
      'デバッグ（ゴムアヒル法）',
    ],
    tags: ['問答法', 'ソクラテス', '教育', '対話', 'マイエウティケー', '産婆術'],
    isFree: true,
    createdAt: new Date().toISOString(),
  },

  {
    id: 'AX-010',
    nameJa: '帰納と演繹',
    nameEn: 'Induction and Deduction',
    tier: 'foundation',
    category: 'logic',
    coreDefinition: '帰納: 個別の事例から一般法則を導く。演繹: 一般法則から個別の結論を導く。',
    detailedExplanation:
      '科学的思考の2大手法。' +
      '帰納（ベーコン）: りんごが落ちる→月も落ちる→万有引力の法則（ニュートン）。' +
      '演繹（ユークリッド・デカルト）: 公理→定理→証明。' +
      '現代科学は「仮説→演繹→実験で帰納」という循環を繰り返す（仮説演繹法）。' +
      '公理OSでは「公理から演繹」と「体験から帰納」を両方サポートする。',
    formula: {
      latex:
        '\\text{帰納: } \\{a_1, a_2, ..., a_n\\} \\Rightarrow P\n' +
        '\\\\\n' +
        '\\text{演繹: } P \\land (P \\Rightarrow Q) \\Rightarrow Q',
      description: '帰納は事例の集合から一般命題Pを、演繹はPからQを導く。',
    },
    relatedAxiomIds: ['AX-003', 'AX-004', 'AX-005'],
    historianIds: ['aristotle', 'descartes', 'newton'],
    applications: [
      '機械学習（データから帰納的に学習）',
      '数学的証明（公理からの演繹）',
      '医学診断（症状から病気を帰納）',
    ],
    tags: ['帰納', '演繹', '論理', '科学', 'アリストテレス', 'ベーコン', 'デカルト'],
    isFree: true,
    createdAt: new Date().toISOString(),
  },

];

// ─── AxiomDictionary クラス ──────────────────────────────────────────────────

export class AxiomDictionary {
  private entries: Map<string, AxiomEntry>;
  private searchIndex: Map<string, Set<string>>; // タグ/キーワード → エントリIDのセット

  constructor(initialEntries: AxiomEntry[] = INITIAL_AXIOM_ENTRIES) {
    this.entries = new Map();
    this.searchIndex = new Map();

    for (const entry of initialEntries) {
      this.addEntry(entry);
    }
  }

  // ── エントリの追加 ──────────────────────────────────────────────────────

  addEntry(entry: AxiomEntry): void {
    this.entries.set(entry.id, entry);
    this.indexEntry(entry);
  }

  private indexEntry(entry: AxiomEntry): void {
    const tokens = [
      ...entry.tags,
      entry.nameJa,
      entry.nameEn,
      entry.category,
      entry.tier,
      ...entry.applications,
    ].map(t => t.toLowerCase());

    for (const token of tokens) {
      if (!this.searchIndex.has(token)) {
        this.searchIndex.set(token, new Set());
      }
      this.searchIndex.get(token)!.add(entry.id);
    }
  }

  // ── 検索 ────────────────────────────────────────────────────────────────

  /**
   * フルテキスト検索（タグ・名前・カテゴリ・説明に対してスコアリング）
   */
  search(query: string, options?: {
    category?: AxiomCategory;
    tier?: AxiomTier;
    freeOnly?: boolean;
    maxResults?: number;
  }): DictionarySearchResult[] {
    const maxResults = options?.maxResults ?? 10;
    const queryTokens = query.toLowerCase().split(/[\s　、。,]+/).filter(Boolean);

    // スコアマップ
    const scoreMap = new Map<string, number>();
    const matchedFieldsMap = new Map<string, Set<string>>();

    for (const token of queryTokens) {
      // 完全一致
      const exactMatches = this.searchIndex.get(token);
      if (exactMatches) {
        for (const id of exactMatches) {
          scoreMap.set(id, (scoreMap.get(id) || 0) + 1.0);
          if (!matchedFieldsMap.has(id)) matchedFieldsMap.set(id, new Set());
          matchedFieldsMap.get(id)!.add('tag');
        }
      }

      // 部分一致（名前・説明）
      for (const [id, entry] of this.entries) {
        const searchText = [
          entry.nameJa, entry.nameEn,
          entry.coreDefinition, entry.detailedExplanation,
        ].join(' ').toLowerCase();

        if (searchText.includes(token)) {
          scoreMap.set(id, (scoreMap.get(id) || 0) + 0.5);
          if (!matchedFieldsMap.has(id)) matchedFieldsMap.set(id, new Set());
          matchedFieldsMap.get(id)!.add('text');
        }
      }
    }

    // フィルタリング
    let results: DictionarySearchResult[] = [];
    for (const [id, score] of scoreMap) {
      const entry = this.entries.get(id)!;

      if (options?.category && entry.category !== options.category) continue;
      if (options?.tier && entry.tier !== options.tier) continue;
      if (options?.freeOnly && !entry.isFree) continue;

      results.push({
        entry,
        score: score / queryTokens.length,
        matchedFields: Array.from(matchedFieldsMap.get(id) || []),
      });
    }

    // スコア降順ソート
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, maxResults);
  }

  /**
   * IDで取得
   */
  getById(id: string): AxiomEntry | undefined {
    return this.entries.get(id);
  }

  /**
   * カテゴリで取得
   */
  getByCategory(category: AxiomCategory, freeOnly = false): AxiomEntry[] {
    return Array.from(this.entries.values()).filter(
      e => e.category === category && (!freeOnly || e.isFree)
    );
  }

  /**
   * 関連エントリを取得（グラフ展開）
   */
  getRelated(id: string, depth = 1): AxiomEntry[] {
    const visited = new Set<string>([id]);
    const queue = [id];
    const result: AxiomEntry[] = [];

    for (let d = 0; d < depth; d++) {
      const nextQueue: string[] = [];
      for (const currentId of queue) {
        const entry = this.entries.get(currentId);
        if (!entry) continue;

        for (const relId of entry.relatedAxiomIds) {
          if (!visited.has(relId)) {
            visited.add(relId);
            const relEntry = this.entries.get(relId);
            if (relEntry) {
              result.push(relEntry);
              nextQueue.push(relId);
            }
          }
        }
      }
      queue.splice(0, queue.length, ...nextQueue);
    }

    return result;
  }

  /**
   * 歴史人物に関連するエントリを取得
   */
  getByHistorian(historianId: string): AxiomEntry[] {
    return Array.from(this.entries.values()).filter(
      e => e.historianIds.includes(historianId)
    );
  }

  /**
   * フリー層エントリ一覧
   */
  getFreeEntries(): AxiomEntry[] {
    return Array.from(this.entries.values()).filter(e => e.isFree);
  }

  /**
   * 統計情報
   */
  getStats(): DictionaryStats {
    const entries = Array.from(this.entries.values());
    const byCategory = {} as Record<AxiomCategory, number>;
    const byTier = {} as Record<AxiomTier, number>;

    for (const e of entries) {
      byCategory[e.category] = (byCategory[e.category] || 0) + 1;
      byTier[e.tier] = (byTier[e.tier] || 0) + 1;
    }

    return {
      totalEntries: entries.length,
      freeEntries: entries.filter(e => e.isFree).length,
      byCategory,
      byTier,
    };
  }

  /**
   * 質問から関連公理を推薦
   * axiom-brancherと連携して使用
   */
  recommendForQuestion(question: string, maxResults = 5): DictionarySearchResult[] {
    return this.search(question, { maxResults });
  }
}

// ─── シングルトン辞書インスタンス ────────────────────────────────────────────

let _dictionaryInstance: AxiomDictionary | null = null;

export function getAxiomDictionary(): AxiomDictionary {
  if (!_dictionaryInstance) {
    _dictionaryInstance = new AxiomDictionary();
  }
  return _dictionaryInstance;
}
