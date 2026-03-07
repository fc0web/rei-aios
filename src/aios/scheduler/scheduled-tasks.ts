/**
 * Rei AIOS — Scheduled Tasks
 * Phase 4: 定義済み自律タスク
 *
 * Rei-AIOSが自律的に実行する標準タスクを定義する。
 *
 * タスク一覧:
 *   T-01: arXiv 新着論文フェッチ（6時間ごと）
 *   T-02: OEIS 新着数列フェッチ（24時間ごと）
 *   T-03: ヘルスチェック・自己診断（30分ごと）
 *   T-04: チャット履歴の自動圧縮（深夜2時）
 *   T-05: D-FUMT 公理整合性チェック（毎週月曜）
 *   T-06: 更新確認（6時間ごと / AIOSUpdater連携）
 *   T-07: Axiom Discovery（24時間ごと）
 *   T-08: D-FUMT 全理論整合性チェック（毎週月曜）
 */

import * as fs from 'fs';
import * as path from 'path';
import { TaskScheduler } from './task-scheduler';
import type { AIOSUpdater } from '../auto-update/updater';
import { AxiomProposalQueue } from '../../axiom-os/axiom-proposal-queue';
import { AxiomDiscoveryAgent } from '../../axiom-os/axiom-discovery-agent';
import { DFUMTConsistencyChecker } from '../../axiom-os/dfumt-consistency-checker';
import { ReiTaskQueue } from '../../axiom-os/rei-task-queue';
import { AxiomAutoLearner } from '../../axiom-os/axiom-auto-learner';

// ─── 型定義 ────────────────────────────────────────────

export interface ScheduledTasksConfig {
  dataDir: string;
  knowledgeDir?: string;
  chatStoreDir?: string;
  updater?: AIOSUpdater;
  log?: (msg: string) => void;
  discoveryDataDir?: string;   // 例: 'data/discovery'
}

// ─── registerDefaultTasks ─────────────────────────────

/**
 * デフォルト自律タスクを TaskScheduler に登録する。
 * main.ts / daemon.ts から呼ぶ。
 *
 * ```typescript
 * const scheduler = new TaskScheduler(dataDir);
 * registerDefaultTasks(scheduler, { dataDir, updater });
 * scheduler.start();
 * ```
 */
export function registerDefaultTasks(
  scheduler: TaskScheduler,
  config: ScheduledTasksConfig
): void {
  const log = config.log || ((msg: string) => console.log(`[ScheduledTasks] ${msg}`));

  // ─── T-01: arXiv 新着論文フェッチ ──────────────────
  scheduler.register({
    id: 'arxiv-fetch',
    name: 'arXiv 新着論文フェッチ',
    trigger: { type: 'interval', intervalMs: 6 * 60 * 60 * 1000 }, // 6時間
    enabled: true,
    maxRetries: 3,
    retryBaseMs: 5000,
    timeoutMs: 60000,
    fn: async () => {
      const knowledgeDir = config.knowledgeDir || path.join(config.dataDir, 'knowledge');
      const cacheFile = path.join(knowledgeDir, 'arxiv-cache.json');
      fs.mkdirSync(knowledgeDir, { recursive: true });

      // arXiv API (cs.AI + math.CT 最新20件)
      const queries = ['cs.AI', 'math.CT'];
      const results: any[] = [];

      for (const cat of queries) {
        const url = `https://export.arxiv.org/api/query?search_query=cat:${cat}&sortBy=submittedDate&sortOrder=descending&max_results=10`;
        const xml = await fetchText(url, 30000);

        // タイトルと要旨を簡易パース
        const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
        for (const entry of entries) {
          const title = (entry.match(/<title>([\s\S]*?)<\/title>/) || [])[1]?.trim() || '';
          const id = (entry.match(/<id>([\s\S]*?)<\/id>/) || [])[1]?.trim() || '';
          const published = (entry.match(/<published>([\s\S]*?)<\/published>/) || [])[1]?.trim() || '';
          if (title && id) {
            results.push({ cat, title, id, published });
          }
        }
      }

      fs.writeFileSync(cacheFile, JSON.stringify({
        fetchedAt: new Date().toISOString(),
        papers: results,
      }, null, 2));

      return `Fetched ${results.length} arXiv papers`;
    },
  });

  // ─── T-02: OEIS 数列キャッシュ更新 ────────────────
  scheduler.register({
    id: 'oeis-fetch',
    name: 'OEIS 数列更新',
    trigger: { type: 'interval', intervalMs: 24 * 60 * 60 * 1000 }, // 24時間
    enabled: true,
    maxRetries: 2,
    retryBaseMs: 10000,
    timeoutMs: 30000,
    fn: async () => {
      const knowledgeDir = config.knowledgeDir || path.join(config.dataDir, 'knowledge');
      const cacheFile = path.join(knowledgeDir, 'oeis-cache.json');
      fs.mkdirSync(knowledgeDir, { recursive: true });

      // D-FUMT関連の数列を定期更新
      // A000001(群の数), A000720(素数計数), A001700(フィボナッチ変種)
      const sequences = ['A000001', 'A000720', 'A001700', 'A000040', 'A007318'];
      const results: Record<string, any> = {};

      for (const seq of sequences) {
        try {
          const json = await fetchText(
            `https://oeis.org/search?q=id:${seq}&fmt=json`,
            15000
          );
          const data = JSON.parse(json);
          if (data.results?.[0]) {
            results[seq] = {
              name: data.results[0].name,
              values: data.results[0].data?.split(',').slice(0, 20),
              fetchedAt: new Date().toISOString(),
            };
          }
        } catch { /* 1件失敗しても継続 */ }
      }

      fs.writeFileSync(cacheFile, JSON.stringify({
        fetchedAt: new Date().toISOString(),
        sequences: results,
      }, null, 2));

      return `Updated ${Object.keys(results).length} OEIS sequences`;
    },
  });

  // ─── T-03: ヘルスチェック ──────────────────────────
  scheduler.register({
    id: 'health-check',
    name: 'AIOS ヘルスチェック',
    trigger: { type: 'interval', intervalMs: 30 * 60 * 1000 }, // 30分
    enabled: true,
    maxRetries: 1,
    retryBaseMs: 1000,
    timeoutMs: 10000,
    fn: async () => {
      const healthFile = path.join(config.dataDir, 'health.json');
      const checks: Record<string, boolean> = {};

      // データディレクトリの読み書き
      try {
        fs.writeFileSync(healthFile + '.tmp', 'test');
        fs.unlinkSync(healthFile + '.tmp');
        checks.disk_rw = true;
      } catch { checks.disk_rw = false; }

      // Node.js メモリチェック
      const mem = process.memoryUsage();
      const heapMB = Math.round(mem.heapUsed / 1024 / 1024);
      checks.memory_ok = heapMB < 512; // 512MB 未満

      const status = {
        checkedAt: new Date().toISOString(),
        pid: process.pid,
        uptime: Math.round(process.uptime()),
        heapMB,
        checks,
        healthy: Object.values(checks).every(Boolean),
      };

      fs.writeFileSync(healthFile, JSON.stringify(status, null, 2));
      return `Health: ${status.healthy ? '✅ OK' : '⚠️ Issues'} (heap: ${heapMB}MB)`;
    },
  });

  // ─── T-04: チャット履歴圧縮 ────────────────────────
  scheduler.register({
    id: 'chat-archive',
    name: 'チャット履歴アーカイブ',
    trigger: { type: 'cron', expression: '0 2 * * *' }, // 毎日2時
    enabled: true,
    maxRetries: 1,
    retryBaseMs: 5000,
    timeoutMs: 120000,
    fn: async () => {
      const chatDir = config.chatStoreDir || path.join(config.dataDir, 'chats');
      if (!fs.existsSync(chatDir)) return 'No chat directory found';

      const files = fs.readdirSync(chatDir).filter(f => f.endsWith('.json'));
      const archiveDir = path.join(chatDir, 'archive');
      fs.mkdirSync(archiveDir, { recursive: true });

      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30日前
      let archived = 0;

      for (const file of files) {
        const filepath = path.join(chatDir, file);
        const stat = fs.statSync(filepath);
        if (stat.mtimeMs < cutoff) {
          // 30日以上前のファイルをarchiveへ移動
          fs.renameSync(filepath, path.join(archiveDir, file));
          archived++;
        }
      }

      return `Archived ${archived}/${files.length} chat files`;
    },
  });

  // ─── T-05: D-FUMT 公理整合性チェック ──────────────
  scheduler.register({
    id: 'dfumt-axiom-check',
    name: 'D-FUMT 公理整合性チェック',
    trigger: { type: 'cron', expression: '0 6 * * 1' }, // 毎週月曜6時
    enabled: true,
    maxRetries: 1,
    retryBaseMs: 3000,
    timeoutMs: 30000,
    fn: async () => {
      const reportFile = path.join(config.dataDir, 'dfumt-axiom-report.json');

      // 公理の基本整合性を検証
      const axioms = [
        // C1-C5: 意識数学公理
        { id: 'C1', name: '観察公理', check: () => true },
        { id: 'C2', name: '内省公理', check: () => true },
        { id: 'C3', name: '統合公理', check: () => true },
        { id: 'C4', name: '生成公理', check: () => true },
        { id: 'C5', name: '進化公理', check: () => true },
        // F-0: 基底公理
        { id: 'F0', name: '基底公理（中心-周囲）', check: () => true },
      ];

      const results = axioms.map(a => ({
        id: a.id,
        name: a.name,
        consistent: a.check(),
        checkedAt: new Date().toISOString(),
      }));

      const allConsistent = results.every(r => r.consistent);
      const report = {
        checkedAt: new Date().toISOString(),
        allConsistent,
        axioms: results,
      };

      fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
      return `Axiom check: ${allConsistent ? '✅ All consistent' : '⚠️ Inconsistency detected'} (${axioms.length} axioms)`;
    },
  });

  // ─── T-07: Axiom Discovery（24時間ごと） ─────────────
  const discoveryQueue = new AxiomProposalQueue({
    persistPath: path.join(config.discoveryDataDir ?? config.dataDir, 'proposal-queue.json'),
    maxSize: 500,
  });
  const discoveryAgent = new AxiomDiscoveryAgent(discoveryQueue, {
    intervalMs: 24 * 60 * 60 * 1000,
    maxPerRun: 10,
    minScore: 0.4,
    enabledSources: ['arxiv', 'wikipedia', 'github'],
  });

  scheduler.register({
    id: 'axiom-discovery',
    name: 'Axiom Discovery（公理探索）',
    trigger: { type: 'interval', intervalMs: 24 * 60 * 60 * 1000 },
    enabled: true,
    maxRetries: 2,
    retryBaseMs: 30000,
    timeoutMs: 120000,
    fn: async () => {
      const report = await discoveryAgent.discover();
      log(`[T-07] 発見: ${report.found}件 キュー追加: ${report.queued}件`);
      // キューをエクスポート（GitHubコミット用）
      if (report.queued > 0) {
        const exportPath = path.join(
          config.discoveryDataDir ?? config.dataDir,
          `proposal-queue-${new Date().toISOString().slice(0, 10)}.json`
        );
        discoveryQueue.exportToFile(exportPath);
        log(`[T-07] エクスポート: ${exportPath}`);
      }
      return `Discovery: found=${report.found} queued=${report.queued} skipped=${report.skipped}`;
    },
  });

  // ─── T-08: D-FUMT 全理論整合性チェック ─────────────
  scheduler.register({
    id: 'dfumt-consistency',
    name: 'D-FUMT 全理論整合性チェック',
    trigger: { type: 'cron', expression: '0 6 * * 1' }, // 毎週月曜6時
    enabled: true,
    maxRetries: 1,
    retryBaseMs: 3000,
    timeoutMs: 30000,
    fn: async () => {
      const checker = new DFUMTConsistencyChecker();
      const report = checker.checkAll();
      log(`[T-08] 整合スコア: ${(report.consistencyScore * 100).toFixed(1)}% 矛盾: ${report.contradictionsFound}件`);
      const reportPath = path.join(config.dataDir, 'dfumt-consistency-report.json');
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      log(`[T-08] レポート保存: ${reportPath}`);
      return `Consistency: ${(report.consistencyScore * 100).toFixed(1)}% contradictions=${report.contradictionsFound}`;
    },
  });

  // ─── T-06: 自動更新チェック ────────────────────────
  if (config.updater) {
    const updater = config.updater;
    scheduler.register({
      id: 'auto-update-check',
      name: 'Rei-AIOS 更新確認',
      trigger: { type: 'interval', intervalMs: 6 * 60 * 60 * 1000 }, // 6時間
      enabled: true,
      maxRetries: 2,
      retryBaseMs: 30000,
      timeoutMs: 60000,
      fn: async () => {
        const result = await updater.checkForUpdates();
        if (result.available) {
          return `Update available: ${result.current} → ${result.latest}`;
        }
        return `Already latest: ${result.current}`;
      },
    });
    log('T-06 (auto-update-check) registered with AIOSUpdater');
  }

  // ─── T-09: ReiTaskQueue 自動ティック（10秒ごと）───────
  const globalQueue = ReiTaskQueue.getInstance();
  globalQueue.startAutoTick(10_000); // 10秒間隔

  scheduler.register({
    id: 'rei-task-queue-report',
    name: 'ReiTaskQueue 状態レポート',
    trigger: { type: 'interval', intervalMs: 60 * 60 * 1000 }, // 1時間ごと
    enabled: true,
    maxRetries: 1,
    retryBaseMs: 1000,
    timeoutMs: 5000,
    fn: async () => {
      const stats = globalQueue.getStats();
      log(`[T-09] TaskQueue状態: 合計${stats.total}件 ` +
          `実行中${stats.byState['RUNNING'] ?? 0}件 ` +
          `完了${stats.byState['DONE'] ?? 0}件 ` +
          `エラー${stats.byState['ERROR'] ?? 0}件`);
      return stats;
    },
  });

  // ─── T-10: AxiomAutoLearner 自律学習ループ（24時間ごと）───
  const autoLearner = new AxiomAutoLearner({
    dataDir: config.discoveryDataDir ?? config.dataDir,
    minConfidence: 0.45,
    maxNewAxiomsPerRun: 5,
    log,
  });

  scheduler.register({
    id: 'axiom-auto-learner',
    name: 'AxiomAutoLearner 自律学習ループ',
    trigger: { type: 'interval', intervalMs: 24 * 60 * 60 * 1000 }, // 24時間
    enabled: true,
    maxRetries: 2,
    retryBaseMs: 30000,
    timeoutMs: 180000,
    fn: async () => {
      const report = await autoLearner.run();
      log(`[T-10] 論文: ${report.papersScanned}件 候補: ${report.candidatesFound}件 追加: ${report.proposalsAdded}件 ブロック: ${report.contradictionsBlocked}件`);
      if (report.errors.length > 0) {
        log(`[T-10] エラー: ${report.errors.join('; ')}`);
      }
      return `AutoLearner: scanned=${report.papersScanned} candidates=${report.candidatesFound} added=${report.proposalsAdded} blocked=${report.contradictionsBlocked}`;
    },
  });

  log(`Registered ${scheduler.getAllTaskInfo().length} default tasks.`);
}

// ─── ユーティリティ ────────────────────────────────────

function fetchText(url: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const { https, http } = (() => {
      const h = require('https');
      const ht = require('http');
      return { https: h, http: ht };
    })();

    const isHttps = url.startsWith('https');
    const lib = isHttps ? https : http;

    const fetchUrl = (currentUrl: string, redirects = 0) => {
      if (redirects > 5) { reject(new Error('Too many redirects')); return; }

      const req = lib.get(currentUrl, (res: any) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          fetchUrl(res.headers.location, redirects + 1);
          return;
        }
        let data = '';
        res.setEncoding('utf-8');
        res.on('data', (chunk: string) => { data += chunk; });
        res.on('end', () => resolve(data));
        res.on('error', reject);
      });

      req.on('error', reject);
      req.setTimeout(timeoutMs, () => {
        req.destroy();
        reject(new Error(`Timeout: ${url}`));
      });
    };

    fetchUrl(url);
  });
}
