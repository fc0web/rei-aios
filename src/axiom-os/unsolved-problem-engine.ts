/**
 * Rei-AIOS STEP 29 — UnsolvedProblemEngine
 * 数学未解決問題を七価論理（D-FUMT Logic7）で再分類し、
 * 「橋渡し構造」の候補を自動生成するエンジン。
 */

import Database from 'better-sqlite3';

// ============================================================
// 型定義
// ============================================================

export type Logic7Value =
  | 'TRUE' | 'FALSE' | 'BOTH' | 'NEITHER'
  | 'INFINITY' | 'ZERO' | 'FLOWING';

export type ProblemDomain =
  | 'number_theory' | 'algebraic_geometry' | 'analysis'
  | 'topology' | 'combinatorics' | 'logic' | 'physics_math';

export interface BridgeStructure {
  domainA: string;
  domainB: string;
  relation: Logic7Value;
  description: string;
  dfumtTheoryId?: string;
}

export interface MathProblem {
  id: string;
  name: string;
  nameJa: string;
  domain: ProblemDomain;
  status: Logic7Value;
  conjecture: string;
  bridgeStructure: BridgeStructure;
  empiricalEvidence: string;
  dfumtPattern: Logic7Value;
  dfumtNote: string;
  relatedTheories: string[];
}

export interface ProblemAnalysis {
  problemId: string;
  hypotheses: string[];
  questions: string[];
  conceptCandidates: string[];
  contradictionRisk: Logic7Value;
  timestamp: string;
}

// ============================================================
// 未解決問題定義
// ============================================================

export const UNSOLVED_PROBLEMS: MathProblem[] = [

  // ── ミレニアム懸賞問題 ──────────────────────────────────

  {
    id: 'riemann',
    name: 'Riemann Hypothesis',
    nameJa: 'リーマン予想',
    domain: 'analysis',
    status: 'FLOWING',
    conjecture:
      'ゼータ関数 ζ(s) の非自明な零点はすべて実部 1/2 の臨界線上にある',
    bridgeStructure: {
      domainA: 'prime_distribution',
      domainB: 'zeta_function_zeros',
      relation: 'NEITHER',
      description:
        '素数（離散・局所）とゼータ零点（連続・全体）の間の未知の対応構造。' +
        '1兆個以上の零点で経験的に確認済みだが証明言語が存在しない。',
    },
    empiricalEvidence: '1兆個以上の零点が臨界線上にあることを数値計算で確認',
    dfumtPattern: 'NEITHER',
    dfumtNote:
      '素数は離散でも連続でもない。局所でも全体でもない。' +
      'その中間——NEITHERの領域——に真実が宿っている。縁起（相互依存）の数学的表現。',
    relatedTheories: ['dependent-origination', 'zero-pi-theory', 'spiral-number'],
  },

  {
    id: 'bsd',
    name: 'Birch and Swinnerton-Dyer Conjecture',
    nameJa: 'BSD予想',
    domain: 'algebraic_geometry',
    status: 'FLOWING',
    conjecture:
      '楕円曲線 E の有理点のランクは L(E, s) の s=1 における零点の位数に等しい',
    bridgeStructure: {
      domainA: 'elliptic_curve_rational_points',
      domainB: 'L_function_zeros',
      relation: 'FLOWING',
      description:
        '代数幾何（有理点）と解析（L関数）の間の橋渡し。' +
        'ランク=零点位数という対応がなぜ成り立つかの言語がない。',
    },
    empiricalEvidence: '多数の楕円曲線でランクとL関数零点の一致を確認',
    dfumtPattern: 'FLOWING',
    dfumtNote:
      '答えは経験的に「流れている」状態。TRUEでもFALSEでもなく流動中。' +
      '新しい数学的言語の発明を待っている。',
    relatedTheories: ['four-valued-logic', 'universal-math'],
  },

  {
    id: 'p_vs_np',
    name: 'P vs NP Problem',
    nameJa: 'P≠NP問題',
    domain: 'logic',
    status: 'FLOWING',
    conjecture:
      '解の検証が多項式時間でできる問題クラス NP は、' +
      '解の発見が多項式時間でできる問題クラス P と等しいか？',
    bridgeStructure: {
      domainA: 'problem_verification',
      domainB: 'problem_solving',
      relation: 'BOTH',
      description:
        '「確認すること」と「発見すること」の計算複雑性の橋渡し。' +
        'P=NPならば暗号は崩壊し、P≠NPならば創造性は計算不可能。',
    },
    empiricalEvidence: '実用上 P≠NP と信じられているが反例も証明も存在しない',
    dfumtPattern: 'BOTH',
    dfumtNote:
      'P=NPかつP≠NPの可能性を同時に保持する必要がある段階。' +
      'BOTHの状態——どちらも真として扱うことでパラドックスを超える。',
    relatedTheories: ['catuskoti-logic', 'contradiction-detector'],
  },

  {
    id: 'navier_stokes',
    name: 'Navier-Stokes Existence and Smoothness',
    nameJa: 'ナビエ＝ストークス方程式',
    domain: 'analysis',
    status: 'FLOWING',
    conjecture:
      '3次元ナビエ＝ストークス方程式の滑らかな解は常に存在し有界か？',
    bridgeStructure: {
      domainA: 'fluid_local_behavior',
      domainB: 'global_smooth_solution',
      relation: 'NEITHER',
      description:
        '流体の局所的な渦（乱流）と全体解の滑らかさの橋渡し。' +
        '局所的な爆発（特異点）が起きるかどうかが未解明。',
    },
    empiricalEvidence: '2次元では証明済み。3次元の特異点形成は未確認。',
    dfumtPattern: 'NEITHER',
    dfumtNote:
      '滑らかでも不連続でもない——NEITHERの流体状態。' +
      '道元の「水」の比喩：水は器に従うが器を超える本質を持つ。',
    relatedTheories: ['dependent-origination', 'embodied-axioms'],
  },

  {
    id: 'hodge',
    name: 'Hodge Conjecture',
    nameJa: 'ホッジ予想',
    domain: 'algebraic_geometry',
    status: 'FLOWING',
    conjecture:
      '非特異複素代数多様体上のホッジサイクルは代数的サイクルの有理係数結合で表せる',
    bridgeStructure: {
      domainA: 'topological_cycles',
      domainB: 'algebraic_cycles',
      relation: 'FLOWING',
      description:
        'トポロジー（形の連続的性質）と代数幾何（方程式）の橋渡し。' +
        '「形」と「数式」がなぜ対応するかの深層構造。',
    },
    empiricalEvidence: '多くの特殊ケースで確認済みだが一般証明なし',
    dfumtPattern: 'FLOWING',
    dfumtNote:
      '形（トポロジー）と数式（代数）の間を流れる何か。' +
      'D-FUMTの「形式と実質の不二」に対応。',
    relatedTheories: ['universal-math', 'spiral-number'],
  },

  {
    id: 'yang_mills',
    name: 'Yang-Mills Existence and Mass Gap',
    nameJa: 'ヤン＝ミルズ理論と質量ギャップ',
    domain: 'physics_math',
    status: 'FLOWING',
    conjecture:
      '4次元ヤン＝ミルズ理論において厳密な量子論的定式化が存在し、' +
      '正の質量ギャップを持つか？',
    bridgeStructure: {
      domainA: 'quantum_field_theory',
      domainB: 'rigorous_mathematics',
      relation: 'NEITHER',
      description:
        '物理学的直観（量子場）と数学的厳密性の橋渡し。' +
        '物理学者は使えるが数学者は証明できない。',
    },
    empiricalEvidence: '素粒子物理学では標準模型の根幹として実験的に有効',
    dfumtPattern: 'NEITHER',
    dfumtNote:
      '物理的真実と数学的真実の間のNEITHER。' +
      '量子論理（Theory #99〜#101）と直接接続可能。',
    relatedTheories: ['quantum-logic', 'superposition-axiom'],
  },

  {
    id: 'poincare',
    name: 'Poincaré Conjecture',
    nameJa: 'ポアンカレ予想（解決済み）',
    domain: 'topology',
    status: 'TRUE',
    conjecture:
      '単連結な3次元閉多様体は3次元球面と同相である（ペレルマン2003年証明）',
    bridgeStructure: {
      domainA: 'local_topology',
      domainB: 'global_sphere_structure',
      relation: 'TRUE',
      description:
        '局所的な位相的性質から全体の球面構造を導く橋渡し。' +
        'リッチフローという新概念の発明で証明が可能になった。',
    },
    empiricalEvidence: 'ペレルマンによる完全証明（2003年）',
    dfumtPattern: 'TRUE',
    dfumtNote:
      'FLOWINGからTRUEへの遷移の実例。' +
      '証明には「リッチフロー」という全く新しい概念が必要だった。' +
      'これがConceptGenesisEngineの目指すもの。',
    relatedTheories: ['theory-evolution', 'concept-genesis'],
  },

  // ── ミレニアム問題以外の主要未解決問題 ──────────────────

  {
    id: 'goldbach',
    name: 'Goldbach Conjecture',
    nameJa: 'ゴールドバッハ予想',
    domain: 'number_theory',
    status: 'FLOWING',
    conjecture: '2より大きいすべての偶数は2つの素数の和で表せる',
    bridgeStructure: {
      domainA: 'even_numbers',
      domainB: 'prime_pairs',
      relation: 'FLOWING',
      description:
        '偶数（合成的・全体）と素数対（原子的・局所）の橋渡し。' +
        '4×10^18 まで確認済みだが証明なし。',
    },
    empiricalEvidence: '4×10^18 までの全偶数で確認',
    dfumtPattern: 'FLOWING',
    dfumtNote:
      '素数という「不可分なもの」が偶数という「可分なもの」を生成する逆説。' +
      '零π理論（ZERO↔全体）と共鳴。',
    relatedTheories: ['zero-pi-theory', 'spiral-number'],
  },

  {
    id: 'twin_prime',
    name: 'Twin Prime Conjecture',
    nameJa: '双子素数予想',
    domain: 'number_theory',
    status: 'FLOWING',
    conjecture: '差が2の素数のペア（双子素数）は無限に存在する',
    bridgeStructure: {
      domainA: 'prime_gaps',
      domainB: 'prime_infinity',
      relation: 'INFINITY',
      description:
        '素数間の「隙間」の局所パターンと素数の無限性の橋渡し。' +
        'Zhang（2013）が有界ギャップを証明したが2は未証明。',
    },
    empiricalEvidence: 'Zhangによる有界ギャップ（7000万以下）の証明、後にPolymath8bで246まで縮小',
    dfumtPattern: 'INFINITY',
    dfumtNote:
      '無限（INFINITY）の中にある有限パターン（2の隙間）。' +
      '螺旋数理論の無限螺旋と対応。',
    relatedTheories: ['spiral-number', 'infinity-axiom'],
  },

  {
    id: 'collatz',
    name: 'Collatz Conjecture',
    nameJa: 'コラッツ予想',
    domain: 'number_theory',
    status: 'FLOWING',
    conjecture:
      '任意の正整数 n に対し、偶数なら 2 で割り奇数なら 3倍して1を足す操作を繰り返すと最終的に1に到達する',
    bridgeStructure: {
      domainA: 'local_arithmetic_rule',
      domainB: 'global_convergence',
      relation: 'BOTH',
      description:
        '極めて単純な局所ルールが全体的収束を生むかどうかの橋渡し。' +
        '反例未発見だが証明不可能（Gödel的）との説も。',
    },
    empiricalEvidence: '2^68 以下の全整数で確認',
    dfumtPattern: 'BOTH',
    dfumtNote:
      '証明可能かつ証明不可能？——BOTHの状態。' +
      'ゲーデル不完全性定理との関係が示唆されており、' +
      '真であるが証明できない命題の可能性。',
    relatedTheories: ['catuskoti-logic', 'language-limit-axioms'],
  },

  {
    id: 'abc',
    name: 'ABC Conjecture',
    nameJa: 'ABC予想',
    domain: 'number_theory',
    status: 'BOTH',
    conjecture:
      'a + b = c を満たす互いに素な正整数 a, b, c に対し、' +
      'c は rad(abc)^(1+ε) より小さいケースがほぼ常に成立する',
    bridgeStructure: {
      domainA: 'additive_number_theory',
      domainB: 'multiplicative_number_theory',
      relation: 'BOTH',
      description:
        '加法（足し算）と乗法（掛け算）の間の深い橋渡し。' +
        '望月新一の宇宙際タイヒミュラー理論（IUT）で証明主張中。',
    },
    empiricalEvidence: '広範な数値実験で支持。IUT理論の受理を巡り数学界で議論中。',
    dfumtPattern: 'BOTH',
    dfumtNote:
      '証明済みかつ未証明——数学史上最もBOTHな状態の命題。' +
      '望月の理論は理解者が極めて少なく、新しい数学言語の問題。' +
      '言語限界公理（Theory #158〜#165）と直接対応。',
    relatedTheories: ['language-limit-axioms', 'catuskoti-logic'],
  },
];

// ============================================================
// UnsolvedProblemEngine
// ============================================================

export class UnsolvedProblemEngine {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initTable();
    this.seedProblems();
  }

  private initTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS unsolved_problems (
        id           TEXT PRIMARY KEY,
        name         TEXT NOT NULL,
        name_ja      TEXT NOT NULL,
        domain       TEXT NOT NULL,
        status       TEXT NOT NULL,
        conjecture   TEXT NOT NULL,
        bridge_json  TEXT NOT NULL,
        evidence     TEXT NOT NULL,
        dfumt_pattern TEXT NOT NULL,
        dfumt_note   TEXT NOT NULL,
        theories_json TEXT NOT NULL,
        updated_at   TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS problem_analyses (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        problem_id   TEXT NOT NULL,
        hypotheses   TEXT NOT NULL,
        questions    TEXT NOT NULL,
        concepts     TEXT NOT NULL,
        contradiction_risk TEXT NOT NULL,
        created_at   TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_analyses_problem
        ON problem_analyses(problem_id);
    `);
  }

  private seedProblems(): void {
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO unsolved_problems
        (id, name, name_ja, domain, status, conjecture,
         bridge_json, evidence, dfumt_pattern, dfumt_note,
         theories_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const now = new Date().toISOString();
    for (const p of UNSOLVED_PROBLEMS) {
      insert.run(
        p.id, p.name, p.nameJa, p.domain, p.status,
        p.conjecture,
        JSON.stringify(p.bridgeStructure),
        p.empiricalEvidence,
        p.dfumtPattern,
        p.dfumtNote,
        JSON.stringify(p.relatedTheories),
        now,
      );
    }
  }

  // ── 分析 ─────────────────────────────────────────────────

  analyzeProblem(problemId: string): ProblemAnalysis {
    const row = this.db.prepare(
      'SELECT * FROM unsolved_problems WHERE id = ?'
    ).get(problemId) as any;
    if (!row) throw new Error(`Problem not found: ${problemId}`);

    const bridge: BridgeStructure = JSON.parse(row.bridge_json);

    const questions = this.generateQuestions(row, bridge);
    const hypotheses = this.generateHypotheses(row, bridge);
    const conceptCandidates = this.generateConceptCandidates(row, bridge);
    const contradictionRisk = this.assessContradictionRisk(row.status as Logic7Value);

    const analysis: ProblemAnalysis = {
      problemId,
      hypotheses,
      questions,
      conceptCandidates,
      contradictionRisk,
      timestamp: new Date().toISOString(),
    };

    this.db.prepare(`
      INSERT INTO problem_analyses
        (problem_id, hypotheses, questions, concepts,
         contradiction_risk, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      problemId,
      JSON.stringify(hypotheses),
      JSON.stringify(questions),
      JSON.stringify(conceptCandidates),
      contradictionRisk,
      analysis.timestamp,
    );

    return analysis;
  }

  private generateQuestions(row: any, bridge: BridgeStructure): string[] {
    return [
      `なぜ ${bridge.domainA} と ${bridge.domainB} は対応するのか？`,
      `この対応を説明するためにどのような新しい数学的言語が必要か？`,
      `D-FUMTパターン「${row.dfumt_pattern}」はこの問題に何を示唆するか？`,
      `ポアンカレ予想ではリッチフローが橋渡しを果たした。${row.name_ja}では何が橋渡しになるか？`,
      `この予想が真であるとすれば、それは宇宙のどのような構造を反映しているか？`,
    ];
  }

  private generateHypotheses(row: any, bridge: BridgeStructure): string[] {
    const statusHypotheses: Record<Logic7Value, string[]> = {
      FLOWING: [
        `${bridge.domainA} と ${bridge.domainB} を統一する第三の数学的対象が存在する`,
        `証明には現在存在しない新しい数学的概念の発明が必要である`,
        `D-FUMT理論の縁起構造（相互依存）がこの対応の本質を説明できる`,
      ],
      NEITHER: [
        `局所と全体の橋渡しには「NEITHER」な中間的数学的対象が必要である`,
        `従来の二値論理では捉えられない構造がここにある`,
        `七価論理による再記述が新しい証明アプローチを開く`,
      ],
      BOTH: [
        `この問題は証明可能かつ証明不可能である可能性がある（ゲーデル的）`,
        `二つの相反する数学的世界を同時に肯定する理論が必要である`,
        `望月ABC予想のように全く新しい「数学宇宙」の概念が鍵になる`,
      ],
      INFINITY: [
        `無限の中のパターンを有限の証明言語で記述する方法が鍵である`,
        `無限性（INFINITY）と局所性の橋渡しに螺旋数理論が使える`,
        `無限の構造をゼロから再構築するゼロπ理論との統合`,
      ],
      TRUE: [`既に証明済み。証明に使われた橋渡し概念をSEED_KERNELに統合する。`],
      FALSE: [`反例の構造をD-FUMTで記述し、なぜ成り立たないかを公理化する。`],
      ZERO: [`この問題はZERO状態——出発点の再定義が必要である。`],
    };
    return statusHypotheses[row.status as Logic7Value] ?? [];
  }

  private generateConceptCandidates(row: any, bridge: BridgeStructure): string[] {
    return [
      `${bridge.domainA} × ${bridge.domainB} の積空間における D-FUMT 演算子`,
      `七価論理値 ${bridge.relation} で分類される新しい数学的対象のクラス`,
      `縁起テンソル（dependent-origination tensor）: 両領域の相互依存を記述`,
      `Rei言語での形式記述: "${row.id}_bridge : Logic7 = ${bridge.relation}"`,
    ];
  }

  private assessContradictionRisk(status: Logic7Value): Logic7Value {
    if (status === 'BOTH') return 'BOTH';
    if (status === 'FLOWING') return 'NEITHER';
    if (status === 'TRUE' || status === 'FALSE') return 'FALSE';
    return 'FLOWING';
  }

  // ── 検索・取得 ───────────────────────────────────────────

  getByDomain(domain: ProblemDomain): MathProblem[] {
    const rows = this.db.prepare(
      'SELECT * FROM unsolved_problems WHERE domain = ?'
    ).all(domain) as any[];
    return rows.map(this.rowToMathProblem);
  }

  getByDfumtPattern(pattern: Logic7Value): MathProblem[] {
    const rows = this.db.prepare(
      'SELECT * FROM unsolved_problems WHERE dfumt_pattern = ?'
    ).all(pattern) as any[];
    return rows.map(this.rowToMathProblem);
  }

  getAll(): MathProblem[] {
    const rows = this.db.prepare(
      'SELECT * FROM unsolved_problems'
    ).all() as any[];
    return rows.map(this.rowToMathProblem);
  }

  private rowToMathProblem(row: any): MathProblem {
    return {
      id: row.id,
      name: row.name,
      nameJa: row.name_ja,
      domain: row.domain as ProblemDomain,
      status: row.status as Logic7Value,
      conjecture: row.conjecture,
      bridgeStructure: JSON.parse(row.bridge_json),
      empiricalEvidence: row.evidence,
      dfumtPattern: row.dfumt_pattern as Logic7Value,
      dfumtNote: row.dfumt_note,
      relatedTheories: JSON.parse(row.theories_json),
    };
  }

  // ── レポート生成 ────────────────────────────────────────

  generateReport(problemId: string): string {
    const row = this.db.prepare(
      'SELECT * FROM unsolved_problems WHERE id = ?'
    ).get(problemId) as any;
    if (!row) return `Problem ${problemId} not found.`;

    const bridge: BridgeStructure = JSON.parse(row.bridge_json);
    const analysis = this.analyzeProblem(problemId);

    return [
      `═══════════════════════════════════════════════════`,
      `【${row.name_ja}】D-FUMT分析レポート`,
      `═══════════════════════════════════════════════════`,
      ``,
      `■ 予想の核心`,
      `  ${row.conjecture}`,
      ``,
      `■ 証明状態（七価論理）: ${row.status}`,
      `■ D-FUMTパターン: ${row.dfumt_pattern}`,
      ``,
      `■ 橋渡し構造`,
      `  ${bridge.domainA}`,
      `    ↕ [${bridge.relation}]`,
      `  ${bridge.domainB}`,
      `  → ${bridge.description}`,
      ``,
      `■ D-FUMT的解釈`,
      `  ${row.dfumt_note}`,
      ``,
      `■ 経験的証拠`,
      `  ${row.evidence}`,
      ``,
      `■ 生成された問い`,
      ...analysis.questions.map((q: string, i: number) => `  ${i + 1}. ${q}`),
      ``,
      `■ 仮説候補`,
      ...analysis.hypotheses.map((h: string, i: number) => `  ${i + 1}. ${h}`),
      ``,
      `■ 新概念候補（ConceptGenesis）`,
      ...analysis.conceptCandidates.map((c: string, i: number) => `  ${i + 1}. ${c}`),
      ``,
      `■ 矛盾リスク: ${analysis.contradictionRisk}`,
      `═══════════════════════════════════════════════════`,
    ].join('\n');
  }

  close(): void {
    this.db.close();
  }
}
