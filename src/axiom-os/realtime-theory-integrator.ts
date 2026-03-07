/**
 * RealtimeTheoryIntegrator — リアルタイム学習エンジン
 *
 * 会話中に発見された新理論をSEED_KERNELと同形式で即時生成し、
 * TheoryEvolution の EVOLVED_KERNEL に登録する。
 *
 * 機能:
 *   1. 自然言語からの理論抽出 — SevenValueClassifier で七価分類
 *   2. 既存理論との重複チェック — キーワード類似度
 *   3. TheoryEvolution への即時登録
 *   4. 矛盾チェック（ContradictionDetectorEnhanced）
 *   5. 学習履歴の記録
 */

import { SevenValueClassifier, type ClassificationResult } from '../logic/seven-value-classifier';
import { TheoryEvolution, type EvolvedTheory, type TheorySource } from './theory-evolution';
import { ContradictionDetectorEnhanced, type AxiomStatement } from '../logic/contradiction-detector-enhanced';
import { SEED_KERNEL, type SeedTheory } from './seed-kernel';
import type { SevenLogicValue } from './seven-logic';

// ── 型定義 ─────────────────────────────────────────────

export interface TheoryCandidate {
  text:           string;           // 元のテキスト
  axiom:          string;           // 抽出された公理文
  category:       string;           // 推定カテゴリ
  keywords:       string[];         // 抽出キーワード
  dfumtValue:     SevenLogicValue;  // 七価分類結果
  confidence:     number;           // 0〜1
}

export interface IntegrationResult {
  accepted:       boolean;
  theoryId?:      string;           // 登録された場合のID
  reason:         string;
  candidate:      TheoryCandidate;
  duplicateOf?:   string;           // 重複している場合の理論ID
  contradiction?: string;           // 矛盾が検出された場合
}

export interface IntegrationStats {
  totalProcessed:  number;
  accepted:        number;
  rejected:        number;
  duplicates:      number;
  contradictions:  number;
}

// ── カテゴリ推定ルール ──────────────────────────────────

const CATEGORY_PATTERNS: { pattern: RegExp; category: string }[] = [
  { pattern: /量子|quantum|superposition|重ね合わせ|entangle/i, category: 'quantum' },
  { pattern: /論理|logic|証明|proof|定理|theorem/i,             category: 'logic' },
  { pattern: /意識|consciousness|phi|qualia|IIT/i,              category: 'consciousness' },
  { pattern: /数|number|計算|arithmetic|fibonacci|factorial/i,   category: 'numerical' },
  { pattern: /空|sunyata|emptiness|龍樹|nagarjuna|中論/i,       category: 'nagarjuna' },
  { pattern: /縁起|dependent|origination|因果|causal/i,         category: 'logic' },
  { pattern: /カテゴリ|category|関手|functor|圏/i,              category: 'category_theory' },
  { pattern: /AI|自律|autonomous|学習|learning/i,               category: 'ai-integration' },
  { pattern: /沈黙|silence|不立文字/i,                          category: 'silence' },
  { pattern: /ゼロ|zero|原点|void|nothing/i,                    category: 'zero_extension' },
];

// ── RealtimeTheoryIntegrator ───────────────────────────

export class RealtimeTheoryIntegrator {
  private classifier:   SevenValueClassifier;
  private evolution:    TheoryEvolution;
  private detector:     ContradictionDetectorEnhanced;
  private history:      IntegrationResult[] = [];
  private idCounter = 0;

  constructor(evolution?: TheoryEvolution) {
    this.classifier = new SevenValueClassifier();
    this.evolution  = evolution ?? new TheoryEvolution();
    this.detector   = new ContradictionDetectorEnhanced();
  }

  /**
   * 自然言語テキストから理論を抽出し、即時登録を試みる
   */
  integrate(text: string, source: TheorySource = 'ai_discovery'): IntegrationResult {
    // 1. 七価論理で分類
    const classification = this.classifier.classify(text);

    // 2. 理論候補を生成
    const candidate = this.extractCandidate(text, classification);

    // 3. 重複チェック
    const duplicate = this.findDuplicate(candidate);
    if (duplicate) {
      const result: IntegrationResult = {
        accepted: false,
        reason: `既存理論「${duplicate}」と重複`,
        candidate,
        duplicateOf: duplicate,
      };
      this.history.push(result);
      return result;
    }

    // 4. 矛盾チェック
    const contradictionCheck = this.checkContradiction(candidate);
    if (contradictionCheck) {
      const result: IntegrationResult = {
        accepted: false,
        reason: `既存理論と矛盾: ${contradictionCheck}`,
        candidate,
        contradiction: contradictionCheck,
      };
      this.history.push(result);
      return result;
    }

    // 5. TheoryEvolution に登録
    const seed: SeedTheory = {
      id: `dfumt-realtime-${++this.idCounter}`,
      axiom: candidate.axiom,
      category: candidate.category,
      keywords: candidate.keywords,
    };

    const evolved = this.evolution.register(seed, [], source);

    const result: IntegrationResult = {
      accepted: true,
      theoryId: evolved.id,
      reason: `新理論として登録 (${candidate.dfumtValue}, 確信度: ${(candidate.confidence * 100).toFixed(0)}%)`,
      candidate,
    };
    this.history.push(result);
    return result;
  }

  /**
   * 複数テキストをバッチ処理する
   */
  integrateBatch(texts: string[], source: TheorySource = 'ai_discovery'): IntegrationResult[] {
    return texts.map(text => this.integrate(text, source));
  }

  /**
   * 登録済みの進化理論を取得する
   */
  getEvolution(): TheoryEvolution {
    return this.evolution;
  }

  /**
   * 統計情報を返す
   */
  stats(): IntegrationStats {
    return {
      totalProcessed: this.history.length,
      accepted:       this.history.filter(r => r.accepted).length,
      rejected:       this.history.filter(r => !r.accepted).length,
      duplicates:     this.history.filter(r => r.duplicateOf !== undefined).length,
      contradictions: this.history.filter(r => r.contradiction !== undefined).length,
    };
  }

  /**
   * 履歴をリセットする（進化理論はリセットしない）
   */
  resetHistory(): void {
    this.history = [];
  }

  // ── プライベートメソッド ──

  private extractCandidate(text: string, classification: ClassificationResult): TheoryCandidate {
    const category = this.inferCategory(text);
    const keywords = this.extractKeywords(text);
    // 公理文を生成（テキストの要約形式）
    const axiom = text.length > 80 ? text.slice(0, 77) + '...' : text;

    return {
      text,
      axiom,
      category,
      keywords,
      dfumtValue: classification.value as SevenLogicValue,
      confidence: classification.confidence,
    };
  }

  private inferCategory(text: string): string {
    for (const { pattern, category } of CATEGORY_PATTERNS) {
      if (pattern.test(text)) return category;
    }
    return 'general';
  }

  private extractKeywords(text: string): string[] {
    const keywords: string[] = [];
    // 日本語のキーワード抽出（簡易版）
    const importantWords = text.match(/[一-龥ぁ-んァ-ヶ]{2,}/g) ?? [];
    const englishWords = text.match(/[a-zA-Z]{3,}/g) ?? [];
    const allWords = [...importantWords, ...englishWords];
    // 頻出語やストップワードを除外
    const stopWords = new Set(['する', 'ある', 'いる', 'なる', 'こと', 'もの', 'ため', 'the', 'and', 'for']);
    for (const word of allWords) {
      if (!stopWords.has(word.toLowerCase()) && keywords.length < 4) {
        keywords.push(word);
      }
    }
    return keywords.length > 0 ? keywords : ['general'];
  }

  private findDuplicate(candidate: TheoryCandidate): string | null {
    const allTheories = [...SEED_KERNEL, ...this.evolution.getEvolved()];
    for (const theory of allTheories) {
      const similarity = this.keywordSimilarity(candidate.keywords, theory.keywords);
      if (similarity > 0.7) return theory.id;
      // 公理テキストの部分一致
      if (theory.axiom.length > 10 && candidate.axiom.includes(theory.axiom.slice(0, 20))) {
        return theory.id;
      }
    }
    return null;
  }

  private checkContradiction(candidate: TheoryCandidate): string | null {
    const existingStatements: AxiomStatement[] = SEED_KERNEL.slice(0, 20).map(t => ({
      id: t.id,
      content: t.axiom,
      dfumtValue: 'TRUE',
      category: t.category,
      keywords: t.keywords,
    }));

    const newStatement: AxiomStatement = {
      id: 'candidate',
      content: candidate.axiom,
      dfumtValue: candidate.dfumtValue,
      category: candidate.category,
      keywords: candidate.keywords,
    };

    const result = this.detector.detectAll([...existingStatements, newStatement]);
    const critical = result.contradictions.find(
      c => (c.level === 'CRITICAL' || c.level === 'STRONG') &&
           (c.axiomA.id === 'candidate' || c.axiomB.id === 'candidate')
    );

    if (critical) {
      const other = critical.axiomA.id === 'candidate' ? critical.axiomB : critical.axiomA;
      return `${other.id}: ${critical.reason}`;
    }
    return null;
  }

  private keywordSimilarity(a: string[], b: string[]): number {
    if (a.length === 0 || b.length === 0) return 0;
    const setA = new Set(a.map(s => s.toLowerCase()));
    const setB = new Set(b.map(s => s.toLowerCase()));
    let intersection = 0;
    for (const w of setA) {
      if (setB.has(w)) intersection++;
    }
    return intersection / Math.max(setA.size, setB.size);
  }
}
