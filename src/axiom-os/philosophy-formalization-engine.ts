/**
 * Rei-AIOS STEP 30 — PhilosophyFormalizationEngine
 * 哲学・思想・理論テキストを七価論理で分析し数式化する。
 */

import Database from 'better-sqlite3';

// ============================================================
// 型定義
// ============================================================

export type Logic7Value =
  | 'TRUE' | 'FALSE' | 'BOTH' | 'NEITHER'
  | 'INFINITY' | 'ZERO' | 'FLOWING';

export type PhilosophyDomain =
  | 'buddhism' | 'taoism' | 'confucianism' | 'hinduism'
  | 'western_analytic' | 'western_continental' | 'phenomenology'
  | 'mathematics' | 'physics' | 'ethics' | 'epistemology'
  | 'ontology' | 'logic' | 'aesthetics';

export interface PhilosophyPattern {
  keyword: string;
  logic7: Logic7Value;
  mathStructure: string;
  description: string;
}

export interface FormalizedResult {
  inputText: string;
  detectedPatterns: PhilosophyPattern[];
  primaryLogic7: Logic7Value;
  axiomCandidates: AxiomCandidate[];
  isomorphisms: StructuralIsomorphism[];
  reiCode: string;
  relatedTheories: string[];
  confidence: number;
  timestamp: string;
}

export interface AxiomCandidate {
  id: string;
  statement: string;
  formalStatement: string;
  logic7Value: Logic7Value;
  confidence: number;
}

export interface StructuralIsomorphism {
  domainA: string;
  domainB: string;
  structureType: string;
  explanation: string;
  logic7Bridge: Logic7Value;
}

// ============================================================
// 哲学パターン辞書
// ============================================================

export const PHILOSOPHY_PATTERNS: PhilosophyPattern[] = [

  // ── 仏教 ──────────────────────────────────────────────────

  { keyword: '空', logic7: 'NEITHER',
    mathStructure: '圏論: 対象は射（関係）によってのみ定義される',
    description: '固有の実体を持たない。関係性の中にのみ存在する。' },

  { keyword: '無我', logic7: 'NEITHER',
    mathStructure: '集合論: 自己同一性 x=x の否定',
    description: '固定した自己は存在しない。' },

  { keyword: '縁起', logic7: 'FLOWING',
    mathStructure: '有向グラフ: 全ノードが相互に依存',
    description: 'すべては他との関係によって生起する。' },

  { keyword: '無常', logic7: 'FLOWING',
    mathStructure: '微分方程式: 状態の連続的変化 dx/dt ≠ 0',
    description: 'すべては変化し続ける。固定した状態は存在しない。' },

  { keyword: '中道', logic7: 'NEITHER',
    mathStructure: '区間 (a, b) の開区間: 端点を含まない中間',
    description: '両極端を避けた中間の道。' },

  { keyword: '不二', logic7: 'BOTH',
    mathStructure: '商空間: A/~ において A と ¬A が同一視される',
    description: '二つに見えるものが実は一つ。' },

  { keyword: '只管打坐', logic7: 'NEITHER',
    mathStructure: '恒等写像: f(x) = x, 手段 = 目的',
    description: 'ただ座ること自体が悟り。手段と目的の同一。' },

  { keyword: 'ニルヴァーナ', logic7: 'ZERO',
    mathStructure: '零元: 加算しても変化しない ∀x: x + 0 = x',
    description: '欲望の消滅。ゼロ状態への到達。' },

  { keyword: '涅槃', logic7: 'ZERO',
    mathStructure: '零元: 加算しても変化しない ∀x: x + 0 = x',
    description: 'ニルヴァーナと同義。' },

  // ── 道家 ──────────────────────────────────────────────────

  { keyword: '道', logic7: 'FLOWING',
    mathStructure: '位相空間: 開集合系による連続的構造',
    description: '名付けられない根源的流れ。言語を超えた秩序。' },

  { keyword: '無為', logic7: 'ZERO',
    mathStructure: '零作用素: T(x) = 0, 作用しないことによる作用',
    description: '作為しないことが最大の作用。' },

  { keyword: '陰陽', logic7: 'BOTH',
    mathStructure: '複素数: a + bi, 実部と虚部の共存',
    description: '対立する二つが一体として機能する。' },

  { keyword: '自然', logic7: 'FLOWING',
    mathStructure: 'アトラクタ: 系が自然に収束する状態',
    description: '人為を加えない自然な状態への帰還。' },

  // ── 西洋哲学 ─────────────────────────────────────────────

  { keyword: 'イデア', logic7: 'TRUE',
    mathStructure: '抽象代数: 理想（ideal）— 具体例を超えた純粋構造',
    description: '個々の事物の背後にある純粋な形式。' },

  { keyword: 'アルケー', logic7: 'ZERO',
    mathStructure: '原点: 座標系の基点 (0,0,0)',
    description: 'すべての根源となる第一原理。' },

  { keyword: 'ロゴス', logic7: 'TRUE',
    mathStructure: '形式言語: 完全な記述力を持つ論理体系',
    description: '宇宙を貫く理性・言語・論理。' },

  { keyword: 'アポリア', logic7: 'BOTH',
    mathStructure: '不動点なし: ∄x: f(x) = x の状態',
    description: '解決不可能な難問。どちらの答えも成立しない。' },

  { keyword: '弁証法', logic7: 'BOTH',
    mathStructure: 'コホモロジー: 矛盾を高次元で解消する構造',
    description: 'テーゼ・アンチテーゼ・ジンテーゼの運動。' },

  { keyword: 'アウフヘーベン', logic7: 'BOTH',
    mathStructure: '商群: G/N において矛盾が高次で統合される',
    description: '否定しつつ保存し、より高い段階へ。' },

  { keyword: '実存', logic7: 'FLOWING',
    mathStructure: '経路積分: 全ての可能な経路の重ね合わせ',
    description: '本質に先立つ存在。選択によって自己を創る。' },

  { keyword: '超人', logic7: 'INFINITY',
    mathStructure: '極限: lim(x→∞) f(x), 無限への収束',
    description: '現在の人間を超えた可能性の極限。' },

  { keyword: '永劫回帰', logic7: 'INFINITY',
    mathStructure: '周期関数: f(x + T) = f(x), 無限の繰り返し',
    description: 'まったく同じことが無限に繰り返される。' },

  { keyword: 'コギト', logic7: 'TRUE',
    mathStructure: '公理: 証明不要の自明な出発点',
    description: '「我思う、ゆえに我あり」—疑えない最小の確実性。' },

  { keyword: 'モナド', logic7: 'NEITHER',
    mathStructure: 'モナド（圏論）: 自己関手 + 自然変換',
    description: '窓のない閉じた実体。宇宙を内部に反映する。' },

  // ── 現象学 ───────────────────────────────────────────────

  { keyword: '志向性', logic7: 'FLOWING',
    mathStructure: '関数: f: 意識 → 対象, 常に何かへ向かう',
    description: '意識は常に何かについての意識である。' },

  { keyword: 'エポケー', logic7: 'NEITHER',
    mathStructure: '括弧化: 命題を真偽判断から切り離す操作',
    description: '判断を保留し、現象をありのままに見る。' },

  { keyword: '生活世界', logic7: 'FLOWING',
    mathStructure: '多様体: 局所座標系の集合体',
    description: '科学以前の日常的な経験の世界。' },

  { keyword: '身体性', logic7: 'NEITHER',
    mathStructure: '埋め込み: 意識空間 ↪ 物理空間',
    description: '主体としての身体。主観でも客観でもない。' },

  { keyword: '間身体性', logic7: 'BOTH',
    mathStructure: 'テンソル積: A ⊗ B, 二つの身体の相互浸透',
    description: '他者の身体と自己の身体の相互共鳴。' },

  // ── 認識論・論理学 ──────────────────────────────────────

  { keyword: '不完全性', logic7: 'NEITHER',
    mathStructure: 'ゲーデル文: ∃P: Provable(P) = FALSE ∧ True(P) = TRUE',
    description: '十分強い体系は自身の無矛盾性を証明できない。' },

  { keyword: 'パラドックス', logic7: 'BOTH',
    mathStructure: '矛盾: P ∧ ¬P = TRUE in BOTH-logic',
    description: '真でもあり偽でもある命題。' },

  { keyword: 'アポステリオリ', logic7: 'FLOWING',
    mathStructure: '確率的推論: P(H|E) = 経験から更新される信念',
    description: '経験から得られる知識。' },

  { keyword: 'アプリオリ', logic7: 'TRUE',
    mathStructure: '公理: 経験に依存しない自明な真理',
    description: '経験に先立つ必然的知識。' },

  // ── インド哲学 ───────────────────────────────────────────

  { keyword: 'ブラフマン', logic7: 'INFINITY',
    mathStructure: '全体集合: U, すべてを含む宇宙',
    description: '宇宙の根本原理。無限の実在。' },

  { keyword: 'アートマン', logic7: 'TRUE',
    mathStructure: '恒等元: e, ∀x: e・x = x',
    description: '個人の根本的自己。不変の本質。' },

  { keyword: 'マーヤー', logic7: 'FALSE',
    mathStructure: '射影: 3次元を2次元に投影した影',
    description: '幻影。真実を覆い隠す認識の錯誤。' },

  { keyword: 'カルマ', logic7: 'FLOWING',
    mathStructure: '積分: ∫行為(t)dt = 蓄積された因果',
    description: '行為の蓄積が未来の状態を決定する。' },

  // ── 数学・物理の思想 ──────────────────────────────────────

  { keyword: '無限', logic7: 'INFINITY',
    mathStructure: 'カントール: |ℕ| < |ℝ| < |P(ℝ)| ... 無限の階層',
    description: '有限を超えた概念。無限にも大きさの階層がある。' },

  { keyword: '連続', logic7: 'FLOWING',
    mathStructure: 'ε-δ論法: 任意の近傍に点が存在する',
    description: '途切れのない連続的変化。' },

  { keyword: '離散', logic7: 'TRUE',
    mathStructure: '自然数: ℕ = {0, 1, 2, ...} 隙間のある数え上げ',
    description: '分離した個別の単位からなる構造。' },

  { keyword: '対称性', logic7: 'TRUE',
    mathStructure: '群: 変換に対して不変な構造 G',
    description: '変換しても変わらない本質的な構造。' },

  { keyword: '不確定性', logic7: 'NEITHER',
    mathStructure: 'ハイゼンベルク: Δx・Δp ≥ ℏ/2',
    description: '位置と運動量を同時に正確に知ることはできない。' },

  { keyword: '重ね合わせ', logic7: 'BOTH',
    mathStructure: '量子状態: |ψ⟩ = α|0⟩ + β|1⟩',
    description: '観測前は複数の状態が同時に存在する。' },
];

// ============================================================
// PhilosophyFormalizationEngine
// ============================================================

export class PhilosophyFormalizationEngine {
  private db: Database.Database;
  private patterns: PhilosophyPattern[];

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.patterns = [...PHILOSOPHY_PATTERNS];
    this.initTable();
  }

  private initTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS formalization_history (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        input_text   TEXT NOT NULL,
        result_json  TEXT NOT NULL,
        primary_logic7 TEXT NOT NULL,
        confidence   REAL NOT NULL,
        created_at   TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS custom_patterns (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        keyword      TEXT NOT NULL UNIQUE,
        logic7       TEXT NOT NULL,
        math_structure TEXT NOT NULL,
        description  TEXT NOT NULL,
        created_at   TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_history_logic7
        ON formalization_history(primary_logic7);
    `);
  }

  // ── メイン処理 ────────────────────────────────────────────

  formalize(inputText: string): FormalizedResult {
    const detectedPatterns = this.detectPatterns(inputText);
    const primaryLogic7 = this.determinePrimaryLogic7(detectedPatterns);
    const axiomCandidates = this.generateAxiomCandidates(inputText, detectedPatterns, primaryLogic7);
    const isomorphisms = this.detectIsomorphisms(detectedPatterns);
    const reiCode = this.generateReiCode(inputText, primaryLogic7, axiomCandidates);
    const relatedTheories = this.findRelatedTheories(detectedPatterns, primaryLogic7);
    const confidence = this.calculateConfidence(detectedPatterns, axiomCandidates);

    const result: FormalizedResult = {
      inputText,
      detectedPatterns,
      primaryLogic7,
      axiomCandidates,
      isomorphisms,
      reiCode,
      relatedTheories,
      confidence,
      timestamp: new Date().toISOString(),
    };

    this.db.prepare(`
      INSERT INTO formalization_history
        (input_text, result_json, primary_logic7, confidence, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(inputText, JSON.stringify(result), primaryLogic7, confidence, result.timestamp);

    return result;
  }

  // ── パターン検出 ─────────────────────────────────────────

  private detectPatterns(text: string): PhilosophyPattern[] {
    const allPatterns = [
      ...this.patterns,
      ...this.getCustomPatterns(),
    ];
    return allPatterns.filter(p =>
      text.includes(p.keyword) ||
      text.toLowerCase().includes(p.keyword.toLowerCase())
    );
  }

  private determinePrimaryLogic7(patterns: PhilosophyPattern[]): Logic7Value {
    if (patterns.length === 0) return 'FLOWING';

    const counts: Partial<Record<Logic7Value, number>> = {};
    for (const p of patterns) {
      counts[p.logic7] = (counts[p.logic7] ?? 0) + 1;
    }

    return (Object.entries(counts).sort(
      ([, a], [, b]) => b - a
    )[0][0] as Logic7Value) ?? 'FLOWING';
  }

  // ── 公理候補生成 ─────────────────────────────────────────

  private generateAxiomCandidates(
    text: string,
    patterns: PhilosophyPattern[],
    primaryLogic7: Logic7Value,
  ): AxiomCandidate[] {
    const candidates: AxiomCandidate[] = [];

    for (const p of patterns) {
      candidates.push({
        id: `axiom-${p.keyword}-${Date.now()}`,
        statement: `「${p.keyword}」の公理: ${p.description}`,
        formalStatement: p.mathStructure,
        logic7Value: p.logic7,
        confidence: 0.8,
      });
    }

    if (candidates.length === 0) {
      candidates.push({
        id: `axiom-default-${Date.now()}`,
        statement: `この命題は ${primaryLogic7} 状態にある`,
        formalStatement: `∃P: Logic7(P) = ${primaryLogic7}`,
        logic7Value: primaryLogic7,
        confidence: 0.4,
      });
    }

    candidates.push({
      id: `axiom-global-${Date.now()}`,
      statement: `この思想体系の全体的な公理`,
      formalStatement: this.generateGlobalFormula(primaryLogic7),
      logic7Value: primaryLogic7,
      confidence: 0.6,
    });

    return candidates;
  }

  private generateGlobalFormula(logic7: Logic7Value): string {
    const templates: Record<Logic7Value, string> = {
      TRUE:     '∀x ∈ Domain: P(x) = TRUE  [普遍的真理]',
      FALSE:    '∀x ∈ Domain: P(x) = FALSE  [普遍的否定]',
      BOTH:     '∀x ∈ Domain: P(x) = TRUE ∧ ¬P(x) = TRUE  [矛盾の許容]',
      NEITHER:  '∀x ∈ Domain: P(x) ≠ TRUE ∧ P(x) ≠ FALSE  [中間的実在]',
      INFINITY: '∀x ∈ Domain: |P(x)| → ∞  [無限への展開]',
      ZERO:     '∀x ∈ Domain: P(x) → 0  [根源への還元]',
      FLOWING:  '∀t: P(x, t) ≠ P(x, t+ε)  [常なる変化・流動]',
    };
    return templates[logic7];
  }

  // ── 構造的同型検出 ──────────────────────────────────────

  private detectIsomorphisms(patterns: PhilosophyPattern[]): StructuralIsomorphism[] {
    const isomorphisms: StructuralIsomorphism[] = [];

    const grouped: Partial<Record<Logic7Value, PhilosophyPattern[]>> = {};
    for (const p of patterns) {
      if (!grouped[p.logic7]) grouped[p.logic7] = [];
      grouped[p.logic7]!.push(p);
    }

    for (const [logic7, group] of Object.entries(grouped)) {
      if (group.length >= 2) {
        for (let i = 0; i < group.length - 1; i++) {
          isomorphisms.push({
            domainA: group[i].keyword,
            domainB: group[i + 1].keyword,
            structureType: `${logic7}構造的同型`,
            explanation:
              `「${group[i].keyword}」と「${group[i+1].keyword}」は ` +
              `同じ ${logic7} 構造を共有する。` +
              `前者: ${group[i].mathStructure} / ` +
              `後者: ${group[i+1].mathStructure}`,
            logic7Bridge: logic7 as Logic7Value,
          });
        }
      }
    }

    isomorphisms.push(...this.getKnownIsomorphisms(patterns));
    return isomorphisms;
  }

  private getKnownIsomorphisms(patterns: PhilosophyPattern[]): StructuralIsomorphism[] {
    const keywords = patterns.map(p => p.keyword);
    const known: StructuralIsomorphism[] = [];

    if (keywords.includes('空') || keywords.includes('縁起')) {
      known.push({
        domainA: '龍樹の空（śūnyatā）',
        domainB: '圏論（Category Theory）',
        structureType: '圏論的同型',
        explanation:
          '「空」: すべての存在は関係性によって定義される ≅ ' +
          '圏論: 対象は射（morphism）によってのみ定義される。' +
          '龍樹（2世紀）は圏論（1945年）を1700年先取りした。',
        logic7Bridge: 'NEITHER',
      });
    }

    if (keywords.includes('弁証法') || keywords.includes('アウフヘーベン')) {
      known.push({
        domainA: 'ヘーゲルの弁証法',
        domainB: '代数的トポロジー（コホモロジー）',
        structureType: 'BOTH構造的同型',
        explanation:
          '弁証法のテーゼ・アンチテーゼ・ジンテーゼ ≅ ' +
          'コホモロジーの境界作用素 d∘d=0 による高次元での矛盾解消。' +
          '矛盾はより高い次元で統合される。',
        logic7Bridge: 'BOTH',
      });
    }

    if (keywords.includes('道') || keywords.includes('自然')) {
      known.push({
        domainA: '老子の「道」',
        domainB: '位相空間・アトラクタ',
        structureType: 'FLOWING構造的同型',
        explanation:
          '「道」: 名付けられない根源的秩序 ≅ ' +
          '位相空間: 開集合系による連続的構造、アトラクタ: 系が自然収束する状態。' +
          '「無為」は零作用素 T(x)=0 に対応。',
        logic7Bridge: 'FLOWING',
      });
    }

    if (keywords.includes('不完全性') || keywords.includes('不確定性')) {
      known.push({
        domainA: 'ゲーデルの不完全性定理',
        domainB: 'ウィトゲンシュタインの言語限界公理（Theory #158〜#165）',
        structureType: 'NEITHER構造的同型',
        explanation:
          '「語り得ぬものについては沈黙せよ」≅ ' +
          '「証明できない真の命題が存在する」。' +
          '言語の限界 = 証明の限界。同じ構造を哲学と数学で発見。',
        logic7Bridge: 'NEITHER',
      });
    }

    return known;
  }

  // ── Rei言語コード生成 ────────────────────────────────────

  private generateReiCode(
    text: string,
    primaryLogic7: Logic7Value,
    axioms: AxiomCandidate[],
  ): string {
    const id = `philosophy_${Date.now()}`;
    const lines: string[] = [
      `-- 哲学形式化: 自動生成コード`,
      `-- 入力: "${text.slice(0, 50)}..."`,
      `-- 生成日時: ${new Date().toISOString()}`,
      ``,
      `-- 主要Logic7分類`,
      `${id}_primary : Logic7 = ${primaryLogic7}`,
      ``,
      `-- 公理定義`,
    ];

    for (const axiom of axioms.slice(0, 3)) {
      const axiomId = axiom.id.replace(/[^a-zA-Z0-9_]/g, '_');
      lines.push(`axiom ${axiomId} {`);
      lines.push(`  statement: "${axiom.statement}"`);
      lines.push(`  formal: "${axiom.formalStatement}"`);
      lines.push(`  value: ${axiom.logic7Value}`);
      lines.push(`}`);
      lines.push(``);
    }

    lines.push(`-- D-FUMT Theory として登録`);
    lines.push(`theory ${id} {`);
    lines.push(`  logic7: ${primaryLogic7}`);
    lines.push(`  axioms: [${axioms.slice(0, 3).map(
      a => `"${a.id.replace(/[^a-zA-Z0-9_]/g, '_')}"`
    ).join(', ')}]`);
    lines.push(`}`);

    return lines.join('\n');
  }

  // ── SEED_KERNEL照合 ──────────────────────────────────────

  private findRelatedTheories(
    patterns: PhilosophyPattern[],
    primaryLogic7: Logic7Value,
  ): string[] {
    const related: string[] = [];

    const theoryMap: Record<Logic7Value, string[]> = {
      NEITHER: ['dependent-origination', 'catuskoti-logic', 'language-limit-axioms', 'embodied-axioms'],
      BOTH: ['catuskoti-logic', 'contradiction-detector', 'quantum-logic', 'dfumt-goedel-both'],
      FLOWING: ['theory-evolution', 'zero-pi-theory', 'spiral-number', 'dfumt-flowing-conjecture'],
      INFINITY: ['infinity-axiom', 'spiral-number', 'dfumt-bridge-structure'],
      ZERO: ['zero-pi-theory', 'dfumt-riemann-bridge'],
      TRUE: ['universal-math', 'formal-axioms'],
      FALSE: ['contradiction-detector', 'formal-axioms'],
    };

    related.push(...(theoryMap[primaryLogic7] ?? []));

    const keywordTheoryMap: Record<string, string> = {
      '空': 'dependent-origination',
      '縁起': 'dependent-origination',
      '只管打坐': 'embodied-axioms',
      '身体性': 'embodied-axioms',
      '不完全性': 'language-limit-axioms',
      '重ね合わせ': 'quantum-logic',
      '無常': 'theory-evolution',
      '弁証法': 'catuskoti-logic',
    };

    for (const p of patterns) {
      const t = keywordTheoryMap[p.keyword];
      if (t && !related.includes(t)) related.push(t);
    }

    return [...new Set(related)].slice(0, 8);
  }

  // ── 信頼度計算 ───────────────────────────────────────────

  private calculateConfidence(
    patterns: PhilosophyPattern[],
    _axioms: AxiomCandidate[],
  ): number {
    if (patterns.length === 0) return 0.3;
    if (patterns.length === 1) return 0.6;
    if (patterns.length >= 3) return 0.85;
    return 0.7;
  }

  // ── カスタムパターン管理 ────────────────────────────────

  addCustomPattern(pattern: PhilosophyPattern): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO custom_patterns
        (keyword, logic7, math_structure, description, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      pattern.keyword, pattern.logic7,
      pattern.mathStructure, pattern.description,
      new Date().toISOString(),
    );
    this.patterns.push(pattern);
  }

  private getCustomPatterns(): PhilosophyPattern[] {
    const rows = this.db.prepare(
      'SELECT * FROM custom_patterns'
    ).all() as any[];
    return rows.map(r => ({
      keyword: r.keyword,
      logic7: r.logic7 as Logic7Value,
      mathStructure: r.math_structure,
      description: r.description,
    }));
  }

  // ── レポート生成 ────────────────────────────────────────

  generateReport(result: FormalizedResult): string {
    const lines = [
      `═══════════════════════════════════════════════════`,
      `  哲学形式化エンジン — D-FUMT分析レポート`,
      `═══════════════════════════════════════════════════`,
      ``,
      `■ 入力テキスト`,
      `  "${result.inputText}"`,
      ``,
      `■ 主要 Logic7 分類: ${result.primaryLogic7}`,
      `■ 信頼度: ${(result.confidence * 100).toFixed(0)}%`,
      ``,
    ];

    if (result.detectedPatterns.length > 0) {
      lines.push(`■ 検出されたパターン（${result.detectedPatterns.length}件）`);
      for (const p of result.detectedPatterns) {
        lines.push(`  [${p.logic7}] ${p.keyword}`);
        lines.push(`    数学構造: ${p.mathStructure}`);
      }
      lines.push(``);
    }

    lines.push(`■ 公理候補（${result.axiomCandidates.length}件）`);
    for (const a of result.axiomCandidates.slice(0, 4)) {
      lines.push(`  • ${a.statement}`);
      lines.push(`    形式: ${a.formalStatement}`);
      lines.push(`    Logic7: ${a.logic7Value}  信頼度: ${(a.confidence*100).toFixed(0)}%`);
    }
    lines.push(``);

    if (result.isomorphisms.length > 0) {
      lines.push(`■ 構造的同型（${result.isomorphisms.length}件）`);
      for (const iso of result.isomorphisms) {
        lines.push(`  ${iso.domainA}`);
        lines.push(`    ≅ [${iso.structureType}]`);
        lines.push(`  ${iso.domainB}`);
        lines.push(`  → ${iso.explanation}`);
        lines.push(``);
      }
    }

    lines.push(`■ SEED_KERNEL関連理論`);
    lines.push(`  ${result.relatedTheories.join(', ')}`);
    lines.push(``);
    lines.push(`■ 生成されたReiコード`);
    lines.push(`${'─'.repeat(52)}`);
    lines.push(result.reiCode);
    lines.push(`${'─'.repeat(52)}`);

    return lines.join('\n');
  }

  close(): void { this.db.close(); }
}
