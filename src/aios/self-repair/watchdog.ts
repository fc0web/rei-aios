/**
 * Rei AIOS — Watchdog & Self-Repair
 * Phase 4: エージェント死活監視・自己修復
 *
 * D-FUMT 中心-周囲パターン（自律進化サイクル §5.2）:
 *   中心 = 健全な実行状態
 *   周囲 = 監視センサー群（メモリ・応答時間・エラー率）
 *   自律進化 = 異常検知 → 診断 → 修復 → 正常化
 *
 * 機能:
 *   - エージェント応答タイムアウト検知
 *   - メモリリーク早期警告
 *   - エラーパターン分類と自動対処
 *   - 回路遮断器（Circuit Breaker）実装
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

// ─── 型定義 ────────────────────────────────────────────

export type ErrorClass =
  | 'network'        // ネットワーク系エラー（一時的）
  | 'timeout'        // タイムアウト
  | 'auth'           // 認証エラー（APIキー等）
  | 'rate-limit'     // レート制限
  | 'server-error'   // サーバー側エラー（5xx）
  | 'parse-error'    // レスポンスパースエラー
  | 'logic-error'    // ロジックバグ（再起動不要）
  | 'oom'            // メモリ不足
  | 'unknown';

export interface ErrorRecord {
  timestamp: string;
  class: ErrorClass;
  message: string;
  context?: string;
}

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface WatchdogStatus {
  healthy: boolean;
  circuitState: CircuitState;
  errorRate: number;       // 直近100件中の失敗率（0〜1）
  memoryMB: number;
  uptimeSeconds: number;
  recentErrors: ErrorRecord[];
  recommendations: string[];
}

// ─── エラー分類器 ─────────────────────────────────────

export class ErrorClassifier {
  /**
   * エラーメッセージからクラスを判定する。
   * Rei言語の「中心（本質）への帰納」原則に基づき、
   * 表層的なメッセージから根本クラスを抽出する。
   */
  static classify(error: Error | string): ErrorClass {
    const msg = (typeof error === 'string' ? error : error.message).toLowerCase();

    if (msg.includes('enotfound') || msg.includes('econnrefused') ||
        msg.includes('network') || msg.includes('socket') ||
        msg.includes('dns')) {
      return 'network';
    }
    if (msg.includes('timeout') || msg.includes('timed out') ||
        msg.includes('etimedout')) {
      return 'timeout';
    }
    if (msg.includes('401') || msg.includes('unauthorized') ||
        msg.includes('api key') || msg.includes('authentication')) {
      return 'auth';
    }
    if (msg.includes('429') || msg.includes('rate limit') ||
        msg.includes('too many requests')) {
      return 'rate-limit';
    }
    if (msg.includes('500') || msg.includes('502') ||
        msg.includes('503') || msg.includes('internal server')) {
      return 'server-error';
    }
    if (msg.includes('json') || msg.includes('parse') ||
        msg.includes('unexpected token')) {
      return 'parse-error';
    }
    if (msg.includes('out of memory') || msg.includes('heap') ||
        msg.includes('enomem')) {
      return 'oom';
    }

    return 'unknown';
  }

  /**
   * エラークラスに応じた推奨アクションを返す
   */
  static getRecommendation(cls: ErrorClass): string {
    const recs: Record<ErrorClass, string> = {
      'network':      '自動リトライ（指数バックオフ）を適用。ネットワーク状態を確認。',
      'timeout':      'タイムアウト値を延長、またはリクエストを分割。',
      'auth':         'APIキーを確認。自動リトライ不可。ユーザーに通知。',
      'rate-limit':   '60秒以上待機後にリトライ。プロバイダーを切り替えることを検討。',
      'server-error': '30秒後にリトライ。継続する場合はプロバイダーを切り替え。',
      'parse-error':  'プロンプトを調整してJSON出力を強制。',
      'logic-error':  'コードを確認。自動修復不可。',
      'oom':          'メモリを解放。チャット履歴を圧縮。プロセスを再起動。',
      'unknown':      '詳細ログを確認。',
    };
    return recs[cls];
  }
}

// ─── Circuit Breaker ──────────────────────────────────

/**
 * 回路遮断器パターン。
 * 連続失敗が閾値を超えると回路を「open」にして呼び出しを遮断。
 * 一定時間後に「half-open」で試験的に再開する。
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failCount = 0;
  private lastFailTime = 0;

  constructor(
    private readonly failureThreshold = 5,
    private readonly openDurationMs = 60000, // 1分
    private readonly log?: (msg: string) => void
  ) {}

  getState(): CircuitState { return this.state; }

  /**
   * 操作を実行。回路がopenなら即座に拒否。
   */
  async execute<T>(fn: () => Promise<T>, label = 'operation'): Promise<T> {
    if (this.state === 'open') {
      const elapsed = Date.now() - this.lastFailTime;
      if (elapsed >= this.openDurationMs) {
        this.state = 'half-open';
        this.log?.(`Circuit half-open: testing ${label}`);
      } else {
        throw new Error(
          `Circuit OPEN — ${label} blocked. Retry in ${Math.round((this.openDurationMs - elapsed) / 1000)}s`
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess(label);
      return result;
    } catch (err) {
      this.onFailure(label);
      throw err;
    }
  }

  private onSuccess(label: string): void {
    if (this.state === 'half-open') {
      this.log?.(`Circuit closed: ${label} succeeded`);
    }
    this.state = 'closed';
    this.failCount = 0;
  }

  private onFailure(label: string): void {
    this.failCount++;
    this.lastFailTime = Date.now();

    if (this.failCount >= this.failureThreshold) {
      this.state = 'open';
      this.log?.(`Circuit OPEN after ${this.failCount} failures: ${label}`);
    }
  }

  reset(): void {
    this.state = 'closed';
    this.failCount = 0;
    this.log?.('Circuit manually reset.');
  }
}

// ─── Watchdog クラス ──────────────────────────────────

export class Watchdog extends EventEmitter {
  private errors: ErrorRecord[] = [];
  private maxErrors = 500;
  private checkTimer: ReturnType<typeof setInterval> | null = null;
  private readonly statusPath: string;
  private log: (msg: string) => void;

  // メモリ警告閾値（MB）
  private readonly memWarnMB = 400;
  private readonly memCritMB = 700;

  constructor(dataDir: string, log?: (msg: string) => void) {
    super();
    this.statusPath = path.join(dataDir, 'watchdog-status.json');
    this.log = log || ((msg) => console.log(`[Watchdog] ${msg}`));
    this.loadErrors(dataDir);
  }

  // ─── エラー記録 ────────────────────────────────────

  recordError(error: Error | string, context?: string): ErrorRecord {
    const cls = ErrorClassifier.classify(error);
    const msg = typeof error === 'string' ? error : error.message;
    const record: ErrorRecord = {
      timestamp: new Date().toISOString(),
      class: cls,
      message: msg,
      context,
    };

    this.errors.push(record);
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }

    this.emit('error-recorded', record);
    this.log(`Error [${cls}]: ${msg}`);

    // 緊急クラス（auth, oom）はすぐ通知
    if (cls === 'auth' || cls === 'oom') {
      this.emit('critical-error', record);
      this.log(`⚠️ CRITICAL: ${cls} error detected`);
    }

    return record;
  }

  // ─── 監視開始 ──────────────────────────────────────

  startMonitoring(intervalMs = 5 * 60 * 1000): void {
    if (this.checkTimer) return;

    this.checkTimer = setInterval(() => {
      this.performCheck();
    }, intervalMs);

    this.log(`Monitoring started (interval: ${intervalMs / 1000}s)`);
  }

  stopMonitoring(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  // ─── ヘルスチェック ────────────────────────────────

  performCheck(): WatchdogStatus {
    const mem = process.memoryUsage();
    const memMB = Math.round(mem.heapUsed / 1024 / 1024);

    // 直近100件のエラー率
    const recent = this.errors.slice(-100);
    const errorRate = recent.length > 0
      ? recent.filter(e => e.class !== 'unknown').length / recent.length
      : 0;

    const recentErrors = this.errors.slice(-5);
    const recommendations: string[] = [];

    // メモリ警告
    if (memMB >= this.memCritMB) {
      recommendations.push('🔴 メモリ使用量が危険水準。プロセス再起動を推奨。');
      this.emit('memory-critical', { memMB });
    } else if (memMB >= this.memWarnMB) {
      recommendations.push('🟡 メモリ使用量が高い。チャット履歴の圧縮を推奨。');
    }

    // エラー率警告
    if (errorRate > 0.5) {
      recommendations.push('🔴 エラー率が50%超。LLMプロバイダーの確認を推奨。');
    } else if (errorRate > 0.2) {
      recommendations.push('🟡 エラー率が上昇中。ログを確認。');
    }

    // auth エラーチェック
    const authErrors = recent.filter(e => e.class === 'auth');
    if (authErrors.length > 0) {
      recommendations.push('🔴 認証エラーが発生。APIキーを確認してください。');
    }

    const status: WatchdogStatus = {
      healthy: recommendations.filter(r => r.startsWith('🔴')).length === 0,
      circuitState: 'closed', // Circuit Breaker は外部で管理
      errorRate,
      memoryMB: memMB,
      uptimeSeconds: Math.round(process.uptime()),
      recentErrors,
      recommendations,
    };

    // ステータスを永続化
    try {
      fs.writeFileSync(this.statusPath, JSON.stringify({
        ...status,
        checkedAt: new Date().toISOString(),
      }, null, 2));
    } catch { /* ignore */ }

    this.emit('health-check', status);
    return status;
  }

  getStatus(): WatchdogStatus {
    return this.performCheck();
  }

  getErrorsByClass(): Record<ErrorClass, number> {
    const counts: Record<string, number> = {};
    for (const e of this.errors) {
      counts[e.class] = (counts[e.class] || 0) + 1;
    }
    return counts as Record<ErrorClass, number>;
  }

  // ─── 永続化 ────────────────────────────────────────

  private loadErrors(dataDir: string): void {
    try {
      const errorPath = path.join(dataDir, 'watchdog-errors.json');
      if (fs.existsSync(errorPath)) {
        this.errors = JSON.parse(fs.readFileSync(errorPath, 'utf-8'));
      }
    } catch { this.errors = []; }
  }

  saveErrors(dataDir: string): void {
    try {
      const errorPath = path.join(dataDir, 'watchdog-errors.json');
      fs.writeFileSync(errorPath, JSON.stringify(this.errors.slice(-200), null, 2));
    } catch { /* ignore */ }
  }
}
