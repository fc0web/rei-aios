import { type SeedTheory } from './seed-kernel';

// 抽出されたコードパターン
export interface CodePattern {
  id: string;
  kind: 'loop' | 'recursion' | 'branch' | 'transform' | 'reduce' | 'compose' | 'guard' | 'constant'
    | 'class' | 'async' | 'error' | 'cast' | 'collection' | 'math' | 'string' | 'object' | 'module' | 'state' | 'debug' | 'compare';
  source: string;       // 元のコード断片
  frequency: number;    // 出現頻度
  axiom: string;        // D-FUMT公理として表現した文字列
  keywords: string[];   // 抽出されたキーワード
  category: string;     // D-FUMTカテゴリ
  confidence: number;   // 七価論理スコア (0.0〜1.0)
}

// 公理抽出結果
export interface ExtractionResult {
  sourceHash: string;         // SHA-256（先頭16文字）
  totalLines: number;
  patterns: CodePattern[];
  seedTheories: SeedTheory[]; // SEED_KERNEL形式に変換済み
  compressionHint: number;    // 推定圧縮率（0.0〜1.0）
  dominantCategory: string;
  sevenLogicTag: string;      // 全体の七価論理タグ
}

// D-FUMTカテゴリマッピング
const KIND_TO_CATEGORY: Record<CodePattern['kind'], string> = {
  loop:      'computation',
  recursion: 'mathematics',
  branch:    'logic',
  transform: 'expansion',
  reduce:    'zero_extension',
  compose:   'unified',
  guard:     'logic',
  constant:  'general',
  class:      'mathematics',
  async:      'expansion',
  error:      'logic',
  cast:       'mathematics',
  collection: 'computation',
  math:       'mathematics',
  string:     'general',
  object:     'general',
  module:     'unified',
  state:      'computation',
  debug:      'general',
  compare:    'logic',
};

// パターン検出ルール（正規表現 + ラベル）
const PATTERN_RULES: Array<{
  kind: CodePattern['kind'];
  pattern: RegExp;
  axiomTemplate: (match: string) => string;
  keywords: string[];
}> = [
  {
    kind: 'loop',
    pattern: /\b(for|while|forEach|map|filter|reduce)\b/g,
    axiomTemplate: (m) => `∀x∈S: f(x) — 反復構造 [${m}]`,
    keywords: ['iteration', 'loop', 'sequence', '∀'],
  },
  {
    kind: 'recursion',
    pattern: /function\s+(\w+)[^{]*\{[^}]*\1\s*\(/g,
    axiomTemplate: (m) => `f(n) = f(n-1) ⊕ base — 再帰構造`,
    keywords: ['recursion', 'self-reference', 'induction'],
  },
  {
    kind: 'branch',
    pattern: /\b(if|else|switch|case|ternary|\?\s*:)\b/g,
    axiomTemplate: (m) => `P∨¬P — 分岐構造 [${m}]`,
    keywords: ['branch', 'condition', 'logic', '∨'],
  },
  {
    kind: 'transform',
    pattern: /\b(map|flatMap|transform|convert|parse|serialize)\b/g,
    axiomTemplate: (m) => `f: A→B — 変換写像 [${m}]`,
    keywords: ['transform', 'mapping', 'morphism'],
  },
  {
    kind: 'reduce',
    pattern: /\b(reduce|fold|accumulate|aggregate|sum|count)\b/g,
    axiomTemplate: (m) => `lim f(n)=L — 縮小収束 [${m}]`,
    keywords: ['reduction', 'convergence', 'lim', 'Ω'],
  },
  {
    kind: 'compose',
    pattern: /\b(pipe|compose|chain|then|async|await|Promise)\b/g,
    axiomTemplate: (m) => `f∘g∘h — 合成パイプライン [${m}]`,
    keywords: ['composition', 'pipeline', 'chain'],
  },
  {
    kind: 'guard',
    pattern: /\b(throw|assert|require|ensure|validate|check)\b/g,
    axiomTemplate: (m) => `requires P → Q — 公理ガード [${m}]`,
    keywords: ['guard', 'axiom', 'precondition', 'requires'],
  },
  {
    kind: 'constant',
    pattern: /\b(const|readonly|final|static)\b/g,
    axiomTemplate: (m) => `c = lim(1/∞) — 定数公理 [${m}]`,
    keywords: ['constant', 'immutable', 'identity'],
  },
  // ⑨ クラス・オブジェクト構造
  {
    kind: 'class',
    pattern: /\b(class|interface|type|struct|extends|implements)\b/g,
    axiomTemplate: (m: string) => `T: Type → ∃x∈T — 型構造 [${m}]`,
    keywords: ['class', 'type', 'structure', 'object'],
  },
  // ⑩ 非同期・並行
  {
    kind: 'async',
    pattern: /\b(async|await|Promise|Observable|Stream|EventEmitter)\b/g,
    axiomTemplate: (m: string) => `f: A→Promise<B> — 非同期写像 [${m}]`,
    keywords: ['async', 'concurrent', 'promise', '～'],
  },
  // ⑪ エラー処理
  {
    kind: 'error',
    pattern: /\b(try|catch|finally|Error|Exception|reject)\b/g,
    axiomTemplate: (m: string) => `P∨¬P∨⊥ — エラー分岐 [${m}]`,
    keywords: ['error', 'exception', 'fault', '⊥'],
  },
  // ⑫ 型キャスト・変換
  {
    kind: 'cast',
    pattern: /\b(as|instanceof|typeof|is|cast|coerce)\b/g,
    axiomTemplate: (m: string) => `A ≅ B — 型同型変換 [${m}]`,
    keywords: ['cast', 'coerce', 'isomorphism'],
  },
  // ⑬ 配列・コレクション操作
  {
    kind: 'collection',
    pattern: /\b(push|pop|shift|unshift|splice|slice|concat|join|split)\b/g,
    axiomTemplate: (m: string) => `S ⊕ x = S' — コレクション変換 [${m}]`,
    keywords: ['collection', 'array', 'list', '⊕'],
  },
  // ⑭ 数学・計算
  {
    kind: 'math',
    pattern: /\b(Math\.|sqrt|pow|abs|floor|ceil|round|PI|log|exp)\b/g,
    axiomTemplate: (m: string) => `f: ℝ→ℝ — 数学関数 [${m}]`,
    keywords: ['math', 'numerical', 'calculation', 'ℝ'],
  },
  // ⑮ 文字列操作
  {
    kind: 'string',
    pattern: /\b(toString|toUpperCase|toLowerCase|trim|replace|match|test|indexOf|includes)\b/g,
    axiomTemplate: (m: string) => `f: Σ*→Σ* — 文字列変換 [${m}]`,
    keywords: ['string', 'text', 'pattern', 'Σ'],
  },
  // ⑯ オブジェクト操作
  {
    kind: 'object',
    pattern: /\b(Object\.|JSON\.|keys|values|entries|assign|freeze|spread)\b/g,
    axiomTemplate: (m: string) => `{k:v} — 構造体操作 [${m}]`,
    keywords: ['object', 'record', 'map', 'key-value'],
  },
  // ⑰ モジュール・インポート
  {
    kind: 'module',
    pattern: /\b(import|export|require|from|default|module)\b/g,
    axiomTemplate: (m: string) => `M₁ → M₂ — モジュール依存 [${m}]`,
    keywords: ['module', 'dependency', 'import', 'export'],
  },
  // ⑱ 状態管理
  {
    kind: 'state',
    pattern: /\b(state|setState|useState|store|dispatch|action|reducer|mutation)\b/g,
    axiomTemplate: (m: string) => `S×A→S' — 状態遷移 [${m}]`,
    keywords: ['state', 'transition', 'mutation', 'store'],
  },
  // ⑲ ログ・デバッグ
  {
    kind: 'debug',
    pattern: /\b(console\.|log|warn|error|debug|trace|assert)\b/g,
    axiomTemplate: (m: string) => `observe(x) — 観測点 [${m}]`,
    keywords: ['observe', 'debug', 'log', '〇'],
  },
  // ⑳ 比較・等値
  {
    kind: 'compare',
    pattern: /===|!==|>=|<=|\b(equals|compareTo|diff|delta)\b/g,
    axiomTemplate: (m: string) => `a ≡ b ∨ a ≠ b — 等値比較 [${m}]`,
    keywords: ['equality', 'comparison', 'delta', '≡'],
  },
];

// 七価論理タグを推定
function inferSevenLogicTag(patterns: CodePattern[]): string {
  const has = (kind: string) => patterns.some(p => p.kind === kind);

  if (has('recursion') && has('branch')) return '[B]';   // both — 再帰×分岐は矛盾許容
  if (has('reduce'))                     return '[Ω]';   // 収束
  if (has('async') && has('error'))      return '[Ω]';   // 非同期+エラー → 収束
  if (has('compose') || has('async'))    return '[～]';   // 流動
  if (has('recursion'))                  return '[∞]';   // 無限
  if (has('state'))                      return '[～]';   // 状態遷移 → 流動
  if (has('class') && has('module'))     return '[B]';   // 構造×依存 → both
  return '[⊤]';
}

// 簡易SHA-256代替（先頭16文字のハッシュ）
function simpleHash(src: string): string {
  let h = 0;
  for (let i = 0; i < src.length; i++) {
    h = (Math.imul(31, h) + src.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16).padStart(8, '0');
}

export class CodeAxiomExtractor {
  // メイン抽出メソッド
  extract(sourceCode: string, language = 'typescript'): ExtractionResult {
    const lines = sourceCode.split('\n');
    const patternMap = new Map<string, CodePattern>();

    for (const rule of PATTERN_RULES) {
      const matches = sourceCode.match(rule.pattern) ?? [];
      if (matches.length === 0) continue;

      const uniqueMatches = [...new Set(matches)];
      for (const match of uniqueMatches) {
        const key = `${rule.kind}:${match}`;
        if (patternMap.has(key)) {
          patternMap.get(key)!.frequency += matches.filter(m => m === match).length;
        } else {
          patternMap.set(key, {
            id: `cae-${rule.kind}-${simpleHash(match)}`,
            kind: rule.kind,
            source: match,
            frequency: matches.filter(m => m === match).length,
            axiom: rule.axiomTemplate(match),
            keywords: [...rule.keywords, language],
            category: KIND_TO_CATEGORY[rule.kind],
            confidence: Math.min(0.95, 0.5 + matches.length * 0.05),
          });
        }
      }
    }

    const patterns = [...patternMap.values()]
      .sort((a, b) => b.frequency - a.frequency);

    // SEED_KERNEL形式へ変換
    const seedTheories: SeedTheory[] = patterns.map(p => ({
      id: p.id,
      axiom: p.axiom,
      keywords: p.keywords,
      category: p.category,
    }));

    // 支配的カテゴリを決定
    const catCount = new Map<string, number>();
    for (const p of patterns) {
      catCount.set(p.category, (catCount.get(p.category) ?? 0) + p.frequency);
    }
    const dominantCategory = [...catCount.entries()]
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'general';

    // 圧縮ヒント: パターン種類数 / 総行数
    const compressionHint = patterns.length > 0
      ? Math.max(0.01, patterns.length / Math.max(lines.length, 1))
      : 1.0;

    return {
      sourceHash: simpleHash(sourceCode),
      totalLines: lines.length,
      patterns,
      seedTheories,
      compressionHint,
      dominantCategory,
      sevenLogicTag: inferSevenLogicTag(patterns),
    };
  }

  // 複数ファイルを分散処理（ConsensusEngine連携用）
  extractBatch(sources: { name: string; code: string }[]): ExtractionResult[] {
    return sources.map(s => this.extract(s.code, s.name.split('.').pop() ?? 'unknown'));
  }

  // 抽出結果から共通公理を合成（ConsensusEngine的マージ）
  mergeResults(results: ExtractionResult[]): ExtractionResult {
    const allPatterns = results.flatMap(r => r.patterns);
    const merged = new Map<string, CodePattern>();

    for (const p of allPatterns) {
      const key = `${p.kind}:${p.source}`;
      if (merged.has(key)) {
        const existing = merged.get(key)!;
        existing.frequency += p.frequency;
        existing.confidence = Math.min(0.99, existing.confidence + 0.05);
      } else {
        merged.set(key, { ...p });
      }
    }

    const patterns = [...merged.values()].sort((a, b) => b.frequency - a.frequency);
    const seedTheories: SeedTheory[] = patterns.map(p => ({
      id: p.id,
      axiom: p.axiom,
      keywords: p.keywords,
      category: p.category,
    }));

    return {
      sourceHash: simpleHash(results.map(r => r.sourceHash).join('')),
      totalLines: results.reduce((s, r) => s + r.totalLines, 0),
      patterns,
      seedTheories,
      compressionHint: patterns.length / Math.max(results.reduce((s, r) => s + r.totalLines, 0), 1),
      dominantCategory: patterns[0]?.category ?? 'general',
      sevenLogicTag: inferSevenLogicTag(patterns),
    };
  }
}
