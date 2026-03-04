import { type SeedTheory } from './seed-kernel';

// 抽出されたコードパターン
export interface CodePattern {
  id: string;
  kind: 'loop' | 'recursion' | 'branch' | 'transform' | 'reduce' | 'compose' | 'guard' | 'constant';
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
];

// 七価論理タグを推定
function inferSevenLogicTag(patterns: CodePattern[]): string {
  const hasRecursion = patterns.some(p => p.kind === 'recursion');
  const hasBranch    = patterns.some(p => p.kind === 'branch');
  const hasReduce    = patterns.some(p => p.kind === 'reduce');
  const hasCompose   = patterns.some(p => p.kind === 'compose');

  if (hasRecursion && hasBranch) return '[B]';  // both — 再帰×分岐は矛盾許容
  if (hasReduce)                  return '[Ω]';  // 収束
  if (hasCompose)                 return '[～]';  // 流動
  if (hasRecursion)               return '[∞]';  // 無限
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
