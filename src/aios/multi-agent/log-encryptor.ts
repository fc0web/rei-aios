/**
 * Rei-AIOS — プライバシーログ分離 (log-encryptor.ts)
 * Phase 1 実装
 *
 * AI間議論エンジンのログを通常ログと完全に分離し、
 * 暗号化して保存する。後から設計を変えると複雑になるため、
 * discussion-engineと同時に実装する。
 *
 * 設計原則:
 *   1. 議論ログは通常ログと別ファイルに保存
 *   2. 内容はAES-256-GCMで暗号化（セッションキー方式）
 *   3. ユーザーは自分のセッションキーのみアクセス可能
 *   4. 保存期間はデフォルト7日、設定可能
 *   5. ログの削除は完全削除（上書きゼロ化）
 *
 * 依存: Node.js組み込みの crypto モジュールのみ（外部依存ゼロ）
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { DiscussionResult, DiscussionStatement } from './discussion-engine';

// ============================================================
// 型定義
// ============================================================

/** 暗号化済みログエントリ */
export interface EncryptedLogEntry {
  id: string;
  sessionId: string;
  timestamp: number;
  expiresAt: number;          // Unix timestamp (自動削除タイミング)
  iv: string;                 // 初期化ベクタ（hex）
  authTag: string;            // GCM認証タグ（hex）
  ciphertext: string;         // 暗号化済み本文（hex）
  contentType: 'statement' | 'result' | 'meta';
}

/** ログストアのインデックス */
export interface LogIndex {
  version: string;
  entries: Array<{
    id: string;
    sessionId: string;
    timestamp: number;
    expiresAt: number;
    contentType: EncryptedLogEntry['contentType'];
  }>;
}

/** セッションキー情報 */
export interface SessionKey {
  sessionId: string;
  key: string;                // 32バイト hex文字列（ユーザーが保管）
  createdAt: number;
  expiresAt: number;
}

/** PrivacyLogger の設定 */
export interface PrivacyLoggerConfig {
  logDir?: string;            // ログ保存ディレクトリ（デフォルト: ~/.rei-aios/privacy-logs）
  retentionDays?: number;     // ログ保持日数（デフォルト: 7）
  autoCleanup?: boolean;      // 起動時に期限切れログを自動削除（デフォルト: true）
}

// ============================================================
// 暗号化ユーティリティ
// ============================================================

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;

function generateKey(): Buffer {
  return crypto.randomBytes(KEY_BYTES);
}

function encrypt(plaintext: string, key: Buffer): { iv: string; authTag: string; ciphertext: string } {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    iv: iv.toString('hex'),
    authTag,
    ciphertext,
  };
}

function decrypt(entry: Pick<EncryptedLogEntry, 'iv' | 'authTag' | 'ciphertext'>, key: Buffer): string {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(entry.iv, 'hex'),
  );
  decipher.setAuthTag(Buffer.from(entry.authTag, 'hex'));

  let plaintext = decipher.update(entry.ciphertext, 'hex', 'utf8');
  plaintext += decipher.final('utf8');
  return plaintext;
}

function secureDelete(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  try {
    const size = fs.statSync(filePath).size;
    // ゼロ上書きしてからファイル削除（簡易版セキュア削除）
    const zeros = Buffer.alloc(Math.min(size, 1024 * 1024)); // 最大1MB
    const fd = fs.openSync(filePath, 'r+');
    fs.writeSync(fd, zeros, 0, zeros.length, 0);
    fs.closeSync(fd);
    fs.unlinkSync(filePath);
  } catch {
    // フォールバック: 通常削除
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
  }
}

// ============================================================
// PrivacyLogger クラス
// ============================================================

export class PrivacyLogger {
  private logDir: string;
  private retentionDays: number;
  private autoCleanup: boolean;

  // セッションIDとキーのマッピング（メモリのみ保持）
  private sessionKeys: Map<string, Buffer> = new Map();

  constructor(config: PrivacyLoggerConfig = {}) {
    this.logDir = config.logDir
      ?? path.join(process.env.HOME || process.env.USERPROFILE || '.', '.rei-aios', 'privacy-logs');
    this.retentionDays = config.retentionDays ?? 7;
    this.autoCleanup = config.autoCleanup ?? true;

    // ディレクトリ作成
    fs.mkdirSync(this.logDir, { recursive: true });

    // 起動時クリーンアップ
    if (this.autoCleanup) {
      this.cleanupExpired();
    }
  }

  // ----------------------------------------------------------
  // セッションキー管理
  // ----------------------------------------------------------

  /**
   * 新しいセッションキーを発行する
   * キーはメモリにのみ保持し、ディスクには書かない
   */
  createSessionKey(sessionId: string): SessionKey {
    const keyBuf = generateKey();
    this.sessionKeys.set(sessionId, keyBuf);

    const now = Date.now();
    const expiresAt = now + this.retentionDays * 24 * 60 * 60 * 1000;

    return {
      sessionId,
      key: keyBuf.toString('hex'),
      createdAt: now,
      expiresAt,
    };
  }

  /**
   * 外部からキーを復元する（ユーザーが保管していたキーを使う場合）
   */
  restoreSessionKey(sessionId: string, keyHex: string): void {
    this.sessionKeys.set(sessionId, Buffer.from(keyHex, 'hex'));
  }

  /**
   * セッションキーをメモリから削除
   */
  revokeSessionKey(sessionId: string): void {
    this.sessionKeys.delete(sessionId);
  }

  // ----------------------------------------------------------
  // ログ書き込み
  // ----------------------------------------------------------

  /**
   * 議論の1発言をログに記録
   */
  logStatement(statement: DiscussionStatement): void {
    const key = this.sessionKeys.get(statement.agentId.split('_')[0]);
    if (!key) return; // キーなし = ログしない

    this._writeEntry(
      statement.agentId.split('_')[0] ?? 'unknown',
      JSON.stringify(statement),
      'statement',
      key,
    );
  }

  /**
   * 議論セッション全体の結果をログに記録
   */
  logResult(result: DiscussionResult): void {
    const key = this.sessionKeys.get(result.sessionId);
    if (!key) return;

    this._writeEntry(result.sessionId, JSON.stringify(result), 'result', key);
  }

  /**
   * メタデータ（設定情報など）をログに記録
   */
  logMeta(sessionId: string, meta: Record<string, unknown>): void {
    const key = this.sessionKeys.get(sessionId);
    if (!key) return;

    this._writeEntry(sessionId, JSON.stringify(meta), 'meta', key);
  }

  // ----------------------------------------------------------
  // ログ読み取り
  // ----------------------------------------------------------

  /**
   * セッションの全ログを復号して返す
   */
  readSession(sessionId: string, keyHex?: string): Array<{
    contentType: EncryptedLogEntry['contentType'];
    content: unknown;
    timestamp: number;
  }> {
    const keyBuf = keyHex
      ? Buffer.from(keyHex, 'hex')
      : this.sessionKeys.get(sessionId);

    if (!keyBuf) {
      throw new Error(`セッション ${sessionId} のキーが見つかりません`);
    }

    const index = this._readIndex();
    const sessionEntries = index.entries.filter(e => e.sessionId === sessionId);
    const results = [];

    for (const meta of sessionEntries) {
      try {
        const entryPath = path.join(this.logDir, `${meta.id}.enc`);
        if (!fs.existsSync(entryPath)) continue;

        const raw = JSON.parse(fs.readFileSync(entryPath, 'utf8')) as EncryptedLogEntry;
        const plaintext = decrypt(raw, keyBuf);

        results.push({
          contentType: raw.contentType,
          content: JSON.parse(plaintext),
          timestamp: raw.timestamp,
        });
      } catch {
        // 復号失敗（キー不一致、破損など）はスキップ
      }
    }

    return results.sort((a, b) => a.timestamp - b.timestamp);
  }

  // ----------------------------------------------------------
  // ログ削除
  // ----------------------------------------------------------

  /**
   * セッションのログをセキュア削除
   */
  deleteSession(sessionId: string): number {
    const index = this._readIndex();
    const toDelete = index.entries.filter(e => e.sessionId === sessionId);

    for (const meta of toDelete) {
      secureDelete(path.join(this.logDir, `${meta.id}.enc`));
    }

    // インデックスを更新
    index.entries = index.entries.filter(e => e.sessionId !== sessionId);
    this._writeIndex(index);

    // メモリのキーも削除
    this.sessionKeys.delete(sessionId);

    return toDelete.length;
  }

  /**
   * 期限切れのログを自動削除
   */
  cleanupExpired(): number {
    const index = this._readIndex();
    const now = Date.now();
    const toDelete = index.entries.filter(e => e.expiresAt < now);

    for (const meta of toDelete) {
      secureDelete(path.join(this.logDir, `${meta.id}.enc`));
    }

    index.entries = index.entries.filter(e => e.expiresAt >= now);
    this._writeIndex(index);

    return toDelete.length;
  }

  /**
   * ログディレクトリの統計を返す
   */
  getStats(): {
    totalSessions: number;
    totalEntries: number;
    oldestEntry: number | null;
    diskUsageBytes: number;
  } {
    const index = this._readIndex();
    const sessions = new Set(index.entries.map(e => e.sessionId));

    let diskUsage = 0;
    let oldest: number | null = null;

    for (const entry of index.entries) {
      const filePath = path.join(this.logDir, `${entry.id}.enc`);
      if (fs.existsSync(filePath)) {
        diskUsage += fs.statSync(filePath).size;
      }
      if (oldest === null || entry.timestamp < oldest) {
        oldest = entry.timestamp;
      }
    }

    return {
      totalSessions: sessions.size,
      totalEntries: index.entries.length,
      oldestEntry: oldest,
      diskUsageBytes: diskUsage,
    };
  }

  // ----------------------------------------------------------
  // プライベートメソッド
  // ----------------------------------------------------------

  private _writeEntry(
    sessionId: string,
    plaintext: string,
    contentType: EncryptedLogEntry['contentType'],
    key: Buffer,
  ): void {
    const id = `log_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = Date.now();
    const expiresAt = now + this.retentionDays * 24 * 60 * 60 * 1000;

    const { iv, authTag, ciphertext } = encrypt(plaintext, key);

    const entry: EncryptedLogEntry = {
      id,
      sessionId,
      timestamp: now,
      expiresAt,
      iv,
      authTag,
      ciphertext,
      contentType,
    };

    // エントリファイルを書き込み
    fs.writeFileSync(
      path.join(this.logDir, `${id}.enc`),
      JSON.stringify(entry),
      'utf8',
    );

    // インデックスを更新
    const index = this._readIndex();
    index.entries.push({ id, sessionId, timestamp: now, expiresAt, contentType });
    this._writeIndex(index);
  }

  private _indexPath(): string {
    return path.join(this.logDir, 'index.json');
  }

  private _readIndex(): LogIndex {
    if (!fs.existsSync(this._indexPath())) {
      return { version: '1.0', entries: [] };
    }
    try {
      return JSON.parse(fs.readFileSync(this._indexPath(), 'utf8')) as LogIndex;
    } catch {
      return { version: '1.0', entries: [] };
    }
  }

  private _writeIndex(index: LogIndex): void {
    fs.writeFileSync(this._indexPath(), JSON.stringify(index, null, 2), 'utf8');
  }
}

// ============================================================
// シングルトンインスタンス（アプリ全体で共有）
// ============================================================

let _defaultLogger: PrivacyLogger | null = null;

export function getPrivacyLogger(config?: PrivacyLoggerConfig): PrivacyLogger {
  if (!_defaultLogger) {
    _defaultLogger = new PrivacyLogger(config);
  }
  return _defaultLogger;
}
