/**
 * Rei-AIOS — AxiomAutoLearner
 * arXiv → 公理候補抽出 → ProposalQueue → ContradictionDetector → SEED_KERNELの
 * 自律的学習ループを管理する。
 */

import { ArxivFetcher } from '../aios/knowledge/arxiv-fetcher';
import { AxiomCandidateExtractor, AxiomCandidate } from './axiom-candidate-extractor';
import { AxiomProposalQueue } from './axiom-proposal-queue';
import { ContradictionDetectorEnhanced } from '../logic/contradiction-detector-enhanced';
import type { AxiomStatement } from '../logic/contradiction-detector-enhanced';
import { SEED_KERNEL, type SeedTheory } from './seed-kernel';
import * as fs from 'fs';
import * as path from 'path';

export interface AutoLearnerConfig {
  dataDir:            string;    // データ保存先（例: './dist'）
  minConfidence?:     number;    // 公理候補の最低スコア（デフォルト 0.45）
  maxNewAxiomsPerRun?: number;   // 1回の実行で追加する最大公理数（デフォルト 5）
  log?:               (msg: string) => void;
}

export interface LearningReport {
  runAt:                string;
  papersScanned:        number;
  candidatesFound:      number;
  proposalsAdded:       number;
  contradictionsBlocked: number;
  errors:               string[];
}

export class AxiomAutoLearner {
  private fetcher:   ArxivFetcher;
  private extractor: AxiomCandidateExtractor;
  private proposals: AxiomProposalQueue;
  private detector:  ContradictionDetectorEnhanced;
  private config:    Required<AutoLearnerConfig>;
  private log:       (msg: string) => void;

  constructor(config: AutoLearnerConfig) {
    this.config = {
      minConfidence:      config.minConfidence ?? 0.45,
      maxNewAxiomsPerRun: config.maxNewAxiomsPerRun ?? 5,
      log:                config.log ?? console.log,
      dataDir:            config.dataDir,
    };
    this.log = this.config.log;

    this.fetcher    = new ArxivFetcher();
    this.extractor  = new AxiomCandidateExtractor();
    this.proposals  = new AxiomProposalQueue({
      persistPath: path.join(config.dataDir, 'proposal-queue.json'),
    });
    this.detector   = new ContradictionDetectorEnhanced();
  }

  /**
   * 学習ループを1回実行する。
   */
  async run(): Promise<LearningReport> {
    const report: LearningReport = {
      runAt:                 new Date().toISOString(),
      papersScanned:         0,
      candidatesFound:       0,
      proposalsAdded:        0,
      contradictionsBlocked: 0,
      errors:                [],
    };

    this.log('[AutoLearner] 学習ループ開始...');

    try {
      // ── 1. arXiv論文取得（哲学+科学プリセット） ──
      let papers: any[] = [];
      try {
        const philosophyPapers = await this.fetcher.fetchPhilosophyAll();
        papers = philosophyPapers;
        report.papersScanned = papers.length;
        this.log(`[AutoLearner] ${papers.length}件の論文を取得`);
      } catch (err: any) {
        report.errors.push(`arXiv取得エラー: ${err.message}`);
        this.log(`[AutoLearner] arXiv取得失敗: ${err.message}`);
      }

      if (papers.length === 0) {
        this.log('[AutoLearner] 論文なし。終了。');
        return report;
      }

      // ── 2. 公理候補抽出 ───────────────────────────────
      const candidates = this.extractor.extract(papers, this.config.minConfidence);
      report.candidatesFound = candidates.length;
      this.log(`[AutoLearner] ${candidates.length}件の公理候補を抽出`);

      // ── 3. 既存公理との矛盾チェック & ProposalQueue追加 ──
      const existingAxioms: AxiomStatement[] = this._loadSeedKernelAsStatements();
      let added = 0;

      for (const cand of candidates.slice(0, this.config.maxNewAxiomsPerRun)) {
        const stmt: AxiomStatement = {
          id:         `arxiv-${cand.sourceId}`,
          content:    cand.axiom,
          dfumtValue: cand.dfumtValue,
          category:   cand.category,
          keywords:   cand.keywords,
        };

        // 矛盾チェック
        const checkResult = this.detector.detect([...existingAxioms, stmt]);
        const hasCritical = checkResult.contradictions.some(
          c => (c.level === 'CRITICAL' || c.level === 'STRONG') &&
               (c.axiomA.id === stmt.id || c.axiomB.id === stmt.id)
        );

        if (hasCritical) {
          report.contradictionsBlocked++;
          this.log(`[AutoLearner] ブロック（矛盾）: ${cand.axiom.slice(0, 60)}`);
          continue;
        }

        // ProposalQueueにenqueue
        try {
          this.proposals.enqueue({
            seed: {
              id:       stmt.id,
              axiom:    cand.axiom,
              category: cand.category,
              keywords: cand.keywords,
            },
            source:         'arxiv',
            sourceUrl:      `https://arxiv.org/abs/${cand.sourceId}`,
            sourceTitle:    cand.sourceTitle,
            discoveryScore: cand.confidence,
            dfumtAlignment: {
              relatedTheoryIds: [],
              alignmentScore:   cand.confidence,
              alignmentNote:    `arXiv自動抽出 (score=${cand.confidence.toFixed(2)})`,
              isContradicting:  false,
            },
          });

          existingAxioms.push(stmt);  // 次の比較に含める
          added++;
          report.proposalsAdded++;
          this.log(`[AutoLearner] 追加: ${cand.axiom.slice(0, 60)}`);
        } catch (err: any) {
          report.errors.push(`Queue追加エラー: ${err.message}`);
        }
      }

      this.log(`[AutoLearner] 完了。追加: ${added}件`);

    } catch (err: any) {
      report.errors.push(`致命的エラー: ${err.message}`);
      this.log(`[AutoLearner] 致命的エラー: ${err.message}`);
    }

    // ── レポート保存 ─────────────────────────────────────
    this._saveReport(report);
    return report;
  }

  private _loadSeedKernelAsStatements(): AxiomStatement[] {
    return SEED_KERNEL.map(t => ({
      id:         t.id,
      content:    t.axiom,
      dfumtValue: 'TRUE' as const,
      category:   t.category,
      keywords:   t.keywords,
    }));
  }

  private _saveReport(report: LearningReport): void {
    try {
      const logPath = path.join(this.config.dataDir, 'auto-learner-log.json');
      let logs: LearningReport[] = [];
      if (fs.existsSync(logPath)) {
        logs = JSON.parse(fs.readFileSync(logPath, 'utf8'));
      }
      logs.push(report);
      // 最新30件のみ保持
      if (logs.length > 30) logs = logs.slice(-30);
      fs.writeFileSync(logPath, JSON.stringify(logs, null, 2), 'utf8');
    } catch { /* ログ保存失敗は無視 */ }
  }
}
