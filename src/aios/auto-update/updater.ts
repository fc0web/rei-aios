/**
 * Rei AIOS — Auto Updater
 * Phase 4: 自動更新機能
 *
 * GitHub Releases から最新版を検出・ダウンロード・適用する。
 * D-FUMT 中心-周囲パターン:
 *   中心 = 現在バージョン（安定核）
 *   周囲 = 更新チャネル（外部情報流入）→ 自己進化
 *
 * 依存: electron-updater
 *   npm install electron-updater
 *   npm install --save-dev @types/electron  (型定義)
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

// ─── 型定義 ────────────────────────────────────────────

export interface UpdaterConfig {
  /** GitHub オーナー名 */
  owner: string;
  /** リポジトリ名 */
  repo: string;
  /** 現在バージョン (package.json から取得) */
  currentVersion: string;
  /** 更新チャンネル: stable | beta | nightly */
  channel: 'stable' | 'beta' | 'nightly';
  /** 自動チェック間隔（ms）。0 = 無効 */
  checkIntervalMs: number;
  /** プリリリースを含めるか */
  allowPrerelease: boolean;
  /** ダウンロード先ディレクトリ */
  downloadDir: string;
  /** ログ関数 */
  log?: (msg: string) => void;
}

export interface ReleaseInfo {
  version: string;
  name: string;
  body: string;
  publishedAt: string;
  downloadUrl: string;
  htmlUrl: string;
  isPrerelease: boolean;
  size: number;
}

export interface UpdateCheckResult {
  available: boolean;
  current: string;
  latest?: string;
  release?: ReleaseInfo;
  error?: string;
}

export type UpdaterState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

// ─── UpdaterEvents ────────────────────────────────────

export interface UpdaterEvents {
  'checking-for-update': [];
  'update-available': [release: ReleaseInfo];
  'update-not-available': [current: string];
  'download-progress': [percent: number, bytesPerSec: number, total: number];
  'update-downloaded': [localPath: string, release: ReleaseInfo];
  'error': [error: Error];
  'state-changed': [state: UpdaterState];
}

// ─── AIOSUpdater クラス ──────────────────────────────

export class AIOSUpdater extends EventEmitter {
  private config: UpdaterConfig;
  private state: UpdaterState = 'idle';
  private checkTimer: ReturnType<typeof setInterval> | null = null;
  private log: (msg: string) => void;

  constructor(config: UpdaterConfig) {
    super();
    this.config = config;
    this.log = config.log || ((msg) => console.log(`[AIOSUpdater] ${msg}`));

    // ダウンロードディレクトリ確保
    if (!fs.existsSync(config.downloadDir)) {
      fs.mkdirSync(config.downloadDir, { recursive: true });
    }
  }

  // ─── 状態管理 ──────────────────────────────────────

  getState(): UpdaterState { return this.state; }

  private setState(s: UpdaterState): void {
    this.state = s;
    this.emit('state-changed', s);
    this.log(`State: ${s}`);
  }

  // ─── 自動チェック開始 ──────────────────────────────

  /**
   * 自動チェックを開始する。
   * config.checkIntervalMs ごとに checkForUpdates() を呼ぶ。
   */
  startAutoCheck(): void {
    if (this.config.checkIntervalMs <= 0) return;
    if (this.checkTimer) return; // 二重起動防止

    this.log(`Auto-check started. Interval: ${this.config.checkIntervalMs}ms`);

    // 起動直後に1回チェック
    this.checkForUpdates().catch(err => {
      this.log(`Initial check error: ${err.message}`);
    });

    this.checkTimer = setInterval(() => {
      this.checkForUpdates().catch(err => {
        this.log(`Periodic check error: ${err.message}`);
      });
    }, this.config.checkIntervalMs);
  }

  stopAutoCheck(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
      this.log('Auto-check stopped.');
    }
  }

  // ─── 更新確認 ─────────────────────────────────────

  async checkForUpdates(): Promise<UpdateCheckResult> {
    if (this.state === 'checking' || this.state === 'downloading') {
      return { available: false, current: this.config.currentVersion };
    }

    this.setState('checking');
    this.emit('checking-for-update');

    try {
      const release = await this.fetchLatestRelease();

      if (!release) {
        this.setState('not-available');
        this.emit('update-not-available', this.config.currentVersion);
        return { available: false, current: this.config.currentVersion };
      }

      const isNewer = this.isNewerVersion(release.version, this.config.currentVersion);

      if (isNewer) {
        this.setState('available');
        this.emit('update-available', release);
        this.log(`Update available: ${this.config.currentVersion} → ${release.version}`);
        return {
          available: true,
          current: this.config.currentVersion,
          latest: release.version,
          release,
        };
      } else {
        this.setState('not-available');
        this.emit('update-not-available', this.config.currentVersion);
        this.log(`Already latest: ${this.config.currentVersion}`);
        return {
          available: false,
          current: this.config.currentVersion,
          latest: release.version,
        };
      }
    } catch (err: any) {
      this.setState('error');
      const error = new Error(`Update check failed: ${err.message}`);
      this.emit('error', error);
      return {
        available: false,
        current: this.config.currentVersion,
        error: error.message,
      };
    }
  }

  // ─── ダウンロード ──────────────────────────────────

  async downloadUpdate(release: ReleaseInfo): Promise<string> {
    if (this.state !== 'available') {
      throw new Error(`Cannot download in state: ${this.state}`);
    }

    this.setState('downloading');
    const fileName = `rei-automator-${release.version}.zip`;
    const localPath = path.join(this.config.downloadDir, fileName);

    this.log(`Downloading ${release.version} from ${release.downloadUrl}`);

    try {
      await this.downloadFile(release.downloadUrl, localPath, (percent, bps, total) => {
        this.emit('download-progress', percent, bps, total);
        if (percent % 10 === 0) {
          this.log(`  Download: ${percent}% (${Math.round(bps / 1024)} KB/s)`);
        }
      });

      this.setState('downloaded');
      this.emit('update-downloaded', localPath, release);
      this.log(`Downloaded to: ${localPath}`);
      return localPath;
    } catch (err: any) {
      this.setState('error');
      const error = new Error(`Download failed: ${err.message}`);
      this.emit('error', error);
      throw error;
    }
  }

  // ─── GitHub API ────────────────────────────────────

  private fetchLatestRelease(): Promise<ReleaseInfo | null> {
    return new Promise((resolve, reject) => {
      const { owner, repo, allowPrerelease } = this.config;
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases`;
      const options = {
        hostname: 'api.github.com',
        path: `/repos/${owner}/${repo}/releases?per_page=10`,
        headers: {
          'User-Agent': `rei-automator/${this.config.currentVersion}`,
          'Accept': 'application/vnd.github+json',
        },
      };

      const req = https.get(options, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            const releases: any[] = JSON.parse(data);
            if (!Array.isArray(releases)) {
              resolve(null);
              return;
            }

            // フィルタリング: チャンネル・プリリリース設定に従う
            const filtered = releases.filter(r => {
              if (!allowPrerelease && r.prerelease) return false;
              return !r.draft;
            });

            if (filtered.length === 0) {
              resolve(null);
              return;
            }

            const latest = filtered[0];
            // zip アセットを探す
            const asset = latest.assets?.find((a: any) =>
              a.name.endsWith('.zip') || a.name.endsWith('.exe') || a.name.endsWith('.dmg')
            );

            resolve({
              version: latest.tag_name.replace(/^v/, ''),
              name: latest.name || latest.tag_name,
              body: latest.body || '',
              publishedAt: latest.published_at,
              downloadUrl: asset?.browser_download_url || latest.zipball_url,
              htmlUrl: latest.html_url,
              isPrerelease: latest.prerelease,
              size: asset?.size || 0,
            });
          } catch (e: any) {
            reject(new Error(`GitHub API parse error: ${e.message}`));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(15000, () => {
        req.destroy();
        reject(new Error('GitHub API timeout'));
      });
    });
  }

  // ─── バージョン比較 ────────────────────────────────

  /**
   * a > b なら true（semver 簡易比較）
   */
  private isNewerVersion(a: string, b: string): boolean {
    const parse = (v: string) =>
      v.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
    const [aMaj, aMin, aPat] = parse(a);
    const [bMaj, bMin, bPat] = parse(b);
    if (aMaj !== bMaj) return aMaj > bMaj;
    if (aMin !== bMin) return aMin > bMin;
    return aPat > bPat;
  }

  // ─── ファイルダウンロード ──────────────────────────

  private downloadFile(
    url: string,
    dest: string,
    onProgress: (percent: number, bps: number, total: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(dest);
      let downloaded = 0;
      let total = 0;
      let startTime = Date.now();

      const fetchUrl = (currentUrl: string, redirectCount = 0) => {
        if (redirectCount > 5) {
          reject(new Error('Too many redirects'));
          return;
        }

        const urlObj = new URL(currentUrl);
        const options = {
          hostname: urlObj.hostname,
          path: urlObj.pathname + urlObj.search,
          headers: { 'User-Agent': `rei-automator/${this.config.currentVersion}` },
        };

        https.get(options, (res) => {
          // リダイレクト処理
          if (res.statusCode === 301 || res.statusCode === 302) {
            fetchUrl(res.headers.location!, redirectCount + 1);
            return;
          }

          total = parseInt(res.headers['content-length'] || '0', 10);
          startTime = Date.now();

          res.on('data', (chunk: Buffer) => {
            downloaded += chunk.length;
            file.write(chunk);

            if (total > 0) {
              const elapsed = (Date.now() - startTime) / 1000;
              const bps = elapsed > 0 ? downloaded / elapsed : 0;
              const percent = Math.round((downloaded / total) * 100);
              onProgress(percent, bps, total);
            }
          });

          res.on('end', () => {
            file.end();
            resolve();
          });

          res.on('error', reject);
        }).on('error', reject);
      };

      file.on('error', reject);
      fetchUrl(url);
    });
  }

  // ─── クリーンアップ ────────────────────────────────

  destroy(): void {
    this.stopAutoCheck();
    this.removeAllListeners();
  }
}

// ─── ファクトリ関数 ────────────────────────────────────

/**
 * package.json から設定を読み込んでUpdaterを生成するユーティリティ
 */
export function createUpdater(
  dataDir: string,
  overrides: Partial<UpdaterConfig> = {}
): AIOSUpdater {
  // package.json からバージョン取得（なければデフォルト）
  let currentVersion = '0.5.0';
  try {
    const pkgPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      currentVersion = pkg.version || currentVersion;
    }
  } catch { /* ignore */ }

  const config: UpdaterConfig = {
    owner: 'fc0web',
    repo: 'rei-automator',
    currentVersion,
    channel: 'stable',
    checkIntervalMs: 6 * 60 * 60 * 1000, // 6時間ごと
    allowPrerelease: false,
    downloadDir: path.join(dataDir, 'updates'),
    ...overrides,
  };

  return new AIOSUpdater(config);
}
