/**
 * NagarjunaChapterScanner — 中論24章の七価論理スキャン
 *
 * SevenValueClassifier を統合し、中論の各章を七価論理でスキャンして
 * NEITHERパターン（空性）を自動検出する。
 *
 * 機能:
 *   1. 中論24章の各章テーマを七価論理で分類
 *   2. NEITHERパターンの自動検出と証明レポート生成
 *   3. NagarjunaProof（既存 第一偈証明）との統合
 *   4. 章間の論理的依存関係の可視化
 */

import { SevenValueClassifier, type ClassificationResult } from '../logic/seven-value-classifier';
import { type SevenLogicValue, and } from './seven-logic';

// ── 型定義 ─────────────────────────────────────────────

export interface ChapterAnalysis {
  chapter:        number;
  title:          string;
  titleSanskrit:  string;
  thesis:         string;        // 主張のテキスト
  classification: ClassificationResult;
  isNeitherPattern: boolean;     // NEITHER（空性）パターンか
  proofNote:      string;        // 証明に関する注記
}

export interface ScanReport {
  totalChapters:    number;
  neitherCount:     number;       // NEITHER判定の章数
  overallValue:     SevenLogicValue;
  chapters:         ChapterAnalysis[];
  logicalChain:     SevenLogicValue[];  // 各章の論理値の連鎖
  summary:          string;
}

// ── 中論24章の定義 ──────────────────────────────────────

interface ChapterDef {
  chapter: number;
  title: string;
  titleSanskrit: string;
  thesis: string;
}

const MULAMADHYAMAKAKARIKA_CHAPTERS: ChapterDef[] = [
  { chapter: 1,  title: '因縁の考察',       titleSanskrit: 'Pratyayaparīkṣā',         thesis: 'いかなるものも自から生じず、他から生じず、両方から生じず、無因から生じない。四不生により自性は空である。' },
  { chapter: 2,  title: '去ること来ることの考察', titleSanskrit: 'Gatāgataparīkṣā',    thesis: '去る者も去られる場所も去る行為も独立に自性を持たない。運動は空である。' },
  { chapter: 3,  title: '見ることの考察',   titleSanskrit: 'Cakṣurādiparīkṣā',        thesis: '見るという行為は見る主体にも見られる対象にも自性として帰属しない。知覚は空である。' },
  { chapter: 4,  title: '五蘊の考察',       titleSanskrit: 'Skandhaparīkṣā',           thesis: '色受想行識の五蘊はいずれも自性を持たず相互依存する。蘊は空である。' },
  { chapter: 5,  title: '六界の考察',       titleSanskrit: 'Dhātuparīkṣā',             thesis: '地水火風空識の六界は独立自存せず、界は空である。' },
  { chapter: 6,  title: '欲望と欲望者の考察', titleSanskrit: 'Rāgaraktaparīkṣā',       thesis: '欲望と欲望する者は相互に依存し、どちらも独立した自性を持たない。' },
  { chapter: 7,  title: '生住滅の考察',     titleSanskrit: 'Utpādādisaṃyuktaparīkṣā',   thesis: '生起も存続も消滅も有為の三相として自性を持たない。変化は空である。' },
  { chapter: 8,  title: '業と業者の考察',   titleSanskrit: 'Karmakārakaparīkṣā',        thesis: '行為者と行為は相互依存であり、どちらも自性を持たない。' },
  { chapter: 9,  title: '先在者の考察',     titleSanskrit: 'Pūrvaparīkṣā',              thesis: '認識主体が認識対象に先行するという見解は成立しない。主客は空である。' },
  { chapter: 10, title: '火と薪の考察',     titleSanskrit: 'Agnīndhanaparīkṣā',         thesis: '火と薪は同一でも別異でもない。両者は相互依存であり空である。' },
  { chapter: 11, title: '生死の前後の考察', titleSanskrit: 'Pūrvāparakoṭiparīkṣā',      thesis: '輪廻の始まりも終わりも確定できない。生死の時間軸は空である。' },
  { chapter: 12, title: '苦の考察',         titleSanskrit: 'Duḥkhaparīkṣā',             thesis: '苦は自ら生じず、他から生じず、両者から生じず、無因から生じない。苦は空である。' },
  { chapter: 13, title: '行の考察',         titleSanskrit: 'Saṃskāraparīkṣā',           thesis: '形成作用は虚妄であり、虚妄であるからこそ空性を示す。' },
  { chapter: 14, title: '和合の考察',       titleSanskrit: 'Saṃsargaparīkṣā',            thesis: '見る者と見られる者と見るという行為の三者の和合は自性を持たない。' },
  { chapter: 15, title: '自性の考察',       titleSanskrit: 'Svabhāvaparīkṣā',            thesis: '自性は生起しない。自性が生起するなら縁起に矛盾する。自性は空である。' },
  { chapter: 16, title: '束縛と解脱の考察', titleSanskrit: 'Bandhanamokṣaparīkṣā',       thesis: '束縛も解脱も自性を持たない。輪廻と涅槃は本質的に異ならない。' },
  { chapter: 17, title: '業と果の考察',     titleSanskrit: 'Karmaphalaparīkṣā',          thesis: '業とその果報は自性を持たないが、空であるからこそ因果が成立する。' },
  { chapter: 18, title: '我と法の考察',     titleSanskrit: 'Ātmaparīkṣā',               thesis: '我（アートマン）は五蘊と同一でも別異でもない。我は空であり、法も空である。' },
  { chapter: 19, title: '時間の考察',       titleSanskrit: 'Kālaparīkṣā',                thesis: '過去・現在・未来は相互依存であり、時間は自性を持たず空である。' },
  { chapter: 20, title: '因果の考察',       titleSanskrit: 'Sāmagrīparīkṣā',             thesis: '原因と結果の和合から結果が生じるのではない。因果は空である。' },
  { chapter: 21, title: '成壊の考察',       titleSanskrit: 'Saṃbhavavibhavaparīkṣā',     thesis: '成立と壊滅は同時に存在せず、別々にも存在しない。成壊は空である。' },
  { chapter: 22, title: '如来の考察',       titleSanskrit: 'Tathāgataparīkṣā',           thesis: '如来は五蘊と同一でも別異でもなく、五蘊を持つとも持たないとも言えない。' },
  { chapter: 23, title: '錯誤の考察',       titleSanskrit: 'Viparyāsaparīkṣā',           thesis: '顛倒は空性の上に成立する。空性がなければ顛倒も正見もない。' },
  { chapter: 24, title: '四聖諦の考察',     titleSanskrit: 'Āryasatyaparīkṣā',           thesis: '空であるからこそ四聖諦が成立する。空性は一切法を可能にする。空でなければ何も成立しない。' },
];

// ── NagarjunaChapterScanner ────────────────────────────

export class NagarjunaChapterScanner {
  private classifier: SevenValueClassifier;

  constructor() {
    this.classifier = new SevenValueClassifier();
  }

  /**
   * 全24章をスキャンし、七価論理でレポートを生成する
   */
  scan(): ScanReport {
    const chapters: ChapterAnalysis[] = [];

    for (const ch of MULAMADHYAMAKAKARIKA_CHAPTERS) {
      const classification = this.classifier.classify(ch.thesis);
      const isNeitherPattern = classification.value === 'NEITHER' ||
        classification.value === 'BOTH'; // BOTHも四句否定の文脈では空に近い

      const proofNote = this.generateProofNote(ch, classification);

      chapters.push({
        chapter: ch.chapter,
        title: ch.title,
        titleSanskrit: ch.titleSanskrit,
        thesis: ch.thesis,
        classification,
        isNeitherPattern,
        proofNote,
      });
    }

    const neitherCount = chapters.filter(c => c.classification.value === 'NEITHER').length;
    const logicalChain = chapters.map(c => c.classification.value as SevenLogicValue);

    // 全章の論理値をAND合成して全体の値を算出
    let overallValue: SevenLogicValue = logicalChain[0];
    for (let i = 1; i < logicalChain.length; i++) {
      overallValue = and(overallValue, logicalChain[i]);
    }

    const summary = this.buildSummary(chapters, neitherCount, overallValue);

    return {
      totalChapters: chapters.length,
      neitherCount,
      overallValue,
      chapters,
      logicalChain,
      summary,
    };
  }

  /**
   * 指定した章のみをスキャンする
   */
  scanChapter(chapterNumber: number): ChapterAnalysis | null {
    const ch = MULAMADHYAMAKAKARIKA_CHAPTERS.find(c => c.chapter === chapterNumber);
    if (!ch) return null;

    const classification = this.classifier.classify(ch.thesis);
    const isNeitherPattern = classification.value === 'NEITHER' || classification.value === 'BOTH';

    return {
      chapter: ch.chapter,
      title: ch.title,
      titleSanskrit: ch.titleSanskrit,
      thesis: ch.thesis,
      classification,
      isNeitherPattern,
      proofNote: this.generateProofNote(ch, classification),
    };
  }

  /**
   * NEITHERパターンの章のみを返す
   */
  findNeitherChapters(): ChapterAnalysis[] {
    return this.scan().chapters.filter(c => c.classification.value === 'NEITHER');
  }

  private generateProofNote(ch: ChapterDef, result: ClassificationResult): string {
    const value = result.value;
    if (value === 'NEITHER') {
      return `第${ch.chapter}章「${ch.title}」: 空性（NEITHER）が直接的に表現されている。` +
        `龍樹の意図と一致。確信度: ${(result.confidence * 100).toFixed(0)}%`;
    }
    if (value === 'BOTH') {
      return `第${ch.chapter}章「${ch.title}」: 矛盾許容（BOTH）として検出。` +
        `四句否定の文脈では空性に近い表現。`;
    }
    if (value === 'FLOWING') {
      return `第${ch.chapter}章「${ch.title}」: 流動（FLOWING）として検出。` +
        `縁起の動的側面を反映。`;
    }
    return `第${ch.chapter}章「${ch.title}」: ${value}として分類。` +
      `空性の間接的表現の可能性あり。`;
  }

  private buildSummary(
    chapters: ChapterAnalysis[],
    neitherCount: number,
    overall: SevenLogicValue,
  ): string {
    const byValue: Record<string, number> = {};
    for (const ch of chapters) {
      const v = ch.classification.value;
      byValue[v] = (byValue[v] ?? 0) + 1;
    }

    const lines = [
      `=== 龍樹の中論 24章 七価論理スキャン結果 ===`,
      `総章数: ${chapters.length}`,
      `NEITHER（空性）直接検出: ${neitherCount}章`,
      `NEITHERパターン（NEITHER+BOTH）: ${chapters.filter(c => c.isNeitherPattern).length}章`,
      '',
      `七価論理値の分布:`,
    ];
    for (const [v, count] of Object.entries(byValue).sort((a, b) => b[1] - a[1])) {
      lines.push(`  ${v}: ${count}章 (${((count / chapters.length) * 100).toFixed(0)}%)`);
    }
    lines.push('');
    lines.push(`全章のAND合成値: ${overall}`);
    lines.push(`結論: 中論全体は ${overall} として形式化される。`);
    if (overall === 'NEITHER' || overall === 'BOTH') {
      lines.push(`→ これは龍樹の空性（śūnyatā）のD-FUMT形式的表現と一致する。`);
    }

    return lines.join('\n');
  }
}
