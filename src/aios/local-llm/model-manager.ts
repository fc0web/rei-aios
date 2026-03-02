/**
 * Rei-AIOS — モデルマネージャー (model-manager.ts)
 * Phase 2 実装
 *
 * GGUFモデルの一覧管理・自動ダウンロード・バージョン確認を担当。
 * ユーザーはモデル名を選ぶだけで、ダウンロードから常駐まで自動で完了する。
 *
 * 対応モデル（Hugging Face / GGUF形式）:
 *   phi3-mini     — Microsoft Phi-3 mini（推奨・バランス型）
 *   tinyllama     — TinyLlama 1.1B（軽量・低スペック向け）
 *   gemma-2b      — Google Gemma 2B（高品質）
 *   deepseek-coder— DeepSeek Coder 6.7B（コード生成特化）
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as os from 'os';
import { EventEmitter } from 'events';
import { LocalLLMAdapter } from './local-llm-adapter';

// ============================================================
// 型定義
// ============================================================

/** モデルのプリセット定義 */
export interface ModelPreset {
  id: string;
  name: string;
  description: string;
  fileName: string;             // GGUFファイル名
  downloadUrl: string;          // ダウンロードURL
  sizeGB: number;               // ファイルサイズ（GB）
  minRamGB: number;             // 必要最低RAM（GB）
  specialty: string;            // 得意分野
  recommended: boolean;         // 推奨モデル
}

/** ダウンロード進捗イベント */
export interface DownloadProgressEvent {
  modelId: string;
  fileName: string;
  downloadedBytes: number;
  totalBytes: number;
  percentage: number;           // 0-100
  speedMBps: number;
  etaSeconds: number;
}

/** モデルの状態 */
export type ModelState = 'available' | 'downloading' | 'downloaded' | 'loaded' | 'error';

/** ローカルモデルのレコード */
export interface LocalModelRecord {
  presetId: string;
  filePath: string;
  downloadedAt: number;
  sizeBytes: number;
  state: ModelState;
}

// ============================================================
// プリセットモデル定義
// ============================================================

export const MODEL_PRESETS: ModelPreset[] = [
  {
    id: 'phi3-mini',
    name: 'Phi-3 mini（推奨）',
    description: 'Microsoftの高性能小型モデル。日本語対応・バランス型。',
    fileName: 'Phi-3-mini-4k-instruct-q4.gguf',
    downloadUrl: 'https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf',
    sizeGB: 2.2,
    minRamGB: 4,
    specialty: '汎用・日本語・コード',
    recommended: true,
  },
  {
    id: 'tinyllama',
    name: 'TinyLlama 1.1B（超軽量）',
    description: '最も軽量。低スペックPCや動作確認に最適。',
    fileName: 'tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
    downloadUrl: 'https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
    sizeGB: 0.6,
    minRamGB: 2,
    specialty: '軽量・高速・動作確認用',
    recommended: false,
  },
  {
    id: 'gemma-2b',
    name: 'Gemma 2B（高品質）',
    description: 'Googleの軽量モデル。回答品質が高い。',
    fileName: 'gemma-2b-it-q4_k_m.gguf',
    downloadUrl: 'https://huggingface.co/google/gemma-2b-it-gguf/resolve/main/gemma-2b-it-q4_k_m.gguf',
    sizeGB: 1.5,
    minRamGB: 4,
    specialty: '高品質・汎用',
    recommended: false,
  },
  {
    id: 'deepseek-coder',
    name: 'DeepSeek Coder 6.7B（コード特化）',
    description: 'コード生成に特化。Rei-AIOSの自動修復に最適。',
    fileName: 'deepseek-coder-6.7b-instruct.Q4_K_M.gguf',
    downloadUrl: 'https://huggingface.co/TheBloke/deepseek-coder-6.7B-instruct-GGUF/resolve/main/deepseek-coder-6.7b-instruct.Q4_K_M.gguf',
    sizeGB: 3.8,
    minRamGB: 6,
    specialty: 'コード生成・自動修復',
    recommended: false,
  },
  // ★ Phase 4-3: 新モデル追加
  {
    id: 'phi4',
    name: 'Phi-4（推論・日本語強化）',
    description: 'MicrosoftのPhi-4。高度な推論・数学・日本語に優れる。D-FUMT理論研究に最適。',
    fileName: 'phi-4-Q4_K_M.gguf',
    downloadUrl: 'https://huggingface.co/bartowski/phi-4-GGUF/resolve/main/phi-4-Q4_K_M.gguf',
    sizeGB: 8.1,
    minRamGB: 12,
    specialty: '推論・数学・日本語・D-FUMT理論',
    recommended: false,
  },
  {
    id: 'deepseek-coder-v2-lite',
    name: 'DeepSeek-Coder V2 Lite（軽量コード特化）',
    description: 'DeepSeek-Coder V2の軽量版。コード生成特化・低スペック向け。',
    fileName: 'DeepSeek-Coder-V2-Lite-Instruct-Q4_K_M.gguf',
    downloadUrl: 'https://huggingface.co/bartowski/DeepSeek-Coder-V2-Lite-Instruct-GGUF/resolve/main/DeepSeek-Coder-V2-Lite-Instruct-Q4_K_M.gguf',
    sizeGB: 9.7,
    minRamGB: 12,
    specialty: 'コード生成・Rei言語・TypeScript',
    recommended: false,
  },
];

// ============================================================
// ModelManager クラス
// ============================================================

export class ModelManager extends EventEmitter {
  private modelsDir: string;
  private records: Map<string, LocalModelRecord> = new Map();
  private activeAdapter: LocalLLMAdapter | null = null;
  private downloadControllers: Map<string, AbortController> = new Map();

  constructor(modelsDir?: string) {
    super();
    this.modelsDir = modelsDir
      ?? path.join(os.homedir(), '.rei-aios', 'models');

    fs.mkdirSync(this.modelsDir, { recursive: true });
    this.loadRecords();
  }

  // ============================================================
  // モデル一覧
  // ============================================================

  /** プリセット一覧を取得（ダウンロード状態付き） */
  getPresets(): Array<ModelPreset & { state: ModelState; localPath?: string }> {
    return MODEL_PRESETS.map(preset => {
      const record = this.records.get(preset.id);
      return {
        ...preset,
        state: record?.state ?? 'available',
        localPath: record?.filePath,
      };
    });
  }

  /** ダウンロード済みモデルの一覧 */
  getDownloadedModels(): LocalModelRecord[] {
    return Array.from(this.records.values())
      .filter(r => r.state === 'downloaded' || r.state === 'loaded');
  }

  /** 推奨モデルを取得 */
  getRecommendedPreset(): ModelPreset {
    return MODEL_PRESETS.find(p => p.recommended) ?? MODEL_PRESETS[0];
  }

  /** システムRAMを確認して実行可能なモデルを絞り込む */
  getCompatiblePresets(): ModelPreset[] {
    const totalRamGB = os.totalmem() / (1024 ** 3);
    return MODEL_PRESETS.filter(p => p.minRamGB <= totalRamGB * 0.7); // 70%を上限
  }

  // ============================================================
  // ダウンロード
  // ============================================================

  /**
   * モデルをダウンロードする
   * 進捗は 'downloadProgress' イベントで通知
   */
  async download(presetId: string): Promise<string> {
    const preset = MODEL_PRESETS.find(p => p.id === presetId);
    if (!preset) throw new Error(`不明なモデルID: ${presetId}`);

    const filePath = path.join(this.modelsDir, preset.fileName);

    // 既にダウンロード済み
    if (fs.existsSync(filePath)) {
      this.updateRecord(presetId, { state: 'downloaded', filePath });
      console.log(`[ModelManager] 既にダウンロード済み: ${preset.fileName}`);
      return filePath;
    }

    // ダウンロード開始
    this.updateRecord(presetId, { state: 'downloading', filePath });
    const controller = new AbortController();
    this.downloadControllers.set(presetId, controller);

    this.emit('downloadStart', { modelId: presetId, fileName: preset.fileName });

    try {
      await this.downloadFile(preset, filePath, controller.signal);
      this.updateRecord(presetId, { state: 'downloaded', filePath });
      this.downloadControllers.delete(presetId);
      this.emit('downloadComplete', { modelId: presetId, filePath });
      return filePath;
    } catch (err) {
      this.updateRecord(presetId, { state: 'error' });
      this.downloadControllers.delete(presetId);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath); // 不完全ファイル削除
      this.emit('downloadError', { modelId: presetId, error: String(err) });
      throw err;
    }
  }

  /** ダウンロードをキャンセル */
  cancelDownload(presetId: string): void {
    const controller = this.downloadControllers.get(presetId);
    if (controller) {
      controller.abort();
      this.downloadControllers.delete(presetId);
      this.updateRecord(presetId, { state: 'available' });
      this.emit('downloadCancelled', { modelId: presetId });
    }
  }

  // ============================================================
  // モデルのロードと常駐
  // ============================================================

  /**
   * モデルをロードしてアダプターとして返す
   * ダウンロードされていない場合は自動でダウンロードする
   */
  async loadModel(presetId: string): Promise<LocalLLMAdapter> {
    let record = this.records.get(presetId);

    // ダウンロードされていない場合は自動ダウンロード
    if (!record || record.state === 'available') {
      console.log(`[ModelManager] モデル未ダウンロード → 自動ダウンロード開始: ${presetId}`);
      await this.download(presetId);
      record = this.records.get(presetId);
    }

    if (!record || !record.filePath) {
      throw new Error(`モデルのロードに失敗: ${presetId}`);
    }

    // 既にロード済みのアダプターがあれば返す
    if (this.activeAdapter?.isReady()) {
      const info = this.activeAdapter.getModelInfo();
      if (info?.path === record.filePath) {
        return this.activeAdapter;
      }
      // 別モデルがロード済みならアンロード
      await this.activeAdapter.unloadModel();
    }

    // 新しいアダプターを作成してロード
    const adapter = new LocalLLMAdapter();
    await adapter.loadModel(record.filePath);

    this.activeAdapter = adapter;
    this.updateRecord(presetId, { state: 'loaded' });
    this.emit('modelLoaded', { modelId: presetId, adapter });

    return adapter;
  }

  /** 現在のアクティブアダプターを取得 */
  getActiveAdapter(): LocalLLMAdapter | null {
    return this.activeAdapter;
  }

  /** モデルをアンロード */
  async unloadModel(): Promise<void> {
    if (this.activeAdapter) {
      await this.activeAdapter.unloadModel();
      this.activeAdapter = null;
    }
  }

  /** モデルファイルを削除 */
  deleteModel(presetId: string): boolean {
    const record = this.records.get(presetId);
    if (!record) return false;

    if (fs.existsSync(record.filePath)) {
      fs.unlinkSync(record.filePath);
    }
    this.records.delete(presetId);
    this.saveRecords();
    this.emit('modelDeleted', { modelId: presetId });
    return true;
  }

  // ============================================================
  // システム情報
  // ============================================================

  /** 使用中のディスク容量（バイト） */
  getTotalDiskUsage(): number {
    let total = 0;
    for (const record of this.records.values()) {
      if (fs.existsSync(record.filePath)) {
        total += fs.statSync(record.filePath).size;
      }
    }
    return total;
  }

  /** システム情報サマリー */
  getSystemInfo(): {
    totalRamGB: number;
    freeRamGB: number;
    modelsDir: string;
    diskUsageGB: number;
    compatibleModels: number;
  } {
    return {
      totalRamGB:      Math.round(os.totalmem() / (1024 ** 3) * 10) / 10,
      freeRamGB:       Math.round(os.freemem()  / (1024 ** 3) * 10) / 10,
      modelsDir:       this.modelsDir,
      diskUsageGB:     Math.round(this.getTotalDiskUsage() / (1024 ** 3) * 100) / 100,
      compatibleModels: this.getCompatiblePresets().length,
    };
  }

  // ============================================================
  // プライベートメソッド
  // ============================================================

  private async downloadFile(
    preset: ModelPreset,
    destPath: string,
    signal: AbortSignal,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const tmpPath = destPath + '.tmp';
      const file = fs.createWriteStream(tmpPath);
      const startTime = Date.now();
      let downloadedBytes = 0;

      const request = https.get(preset.downloadUrl, { signal: signal as never }, (res) => {
        // リダイレクト対応
        if (res.statusCode === 302 || res.statusCode === 301) {
          const location = res.headers.location;
          if (location) {
            file.close();
            https.get(location, (res2) => {
              this.pipeDownload(res2, file, preset, tmpPath, destPath,
                startTime, downloadedBytes, resolve, reject);
            }).on('error', reject);
          }
          return;
        }
        this.pipeDownload(res, file, preset, tmpPath, destPath,
          startTime, downloadedBytes, resolve, reject);
      });

      request.on('error', (err) => {
        file.close();
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        reject(err);
      });

      signal.addEventListener('abort', () => {
        request.destroy();
        file.close();
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        reject(new Error('ダウンロードがキャンセルされました'));
      });
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pipeDownload(res: any, file: fs.WriteStream, preset: ModelPreset,
    tmpPath: string, destPath: string, startTime: number, downloadedBytes: number,
    resolve: () => void, reject: (err: Error) => void): void {

    const totalBytes = parseInt(res.headers['content-length'] ?? '0', 10);

    res.on('data', (chunk: Buffer) => {
      downloadedBytes += chunk.length;
      const elapsed = (Date.now() - startTime) / 1000;
      const speedMBps = (downloadedBytes / (1024 ** 2)) / elapsed;
      const remaining = totalBytes - downloadedBytes;
      const etaSeconds = speedMBps > 0 ? (remaining / (1024 ** 2)) / speedMBps : 0;

      const event: DownloadProgressEvent = {
        modelId: preset.id,
        fileName: preset.fileName,
        downloadedBytes,
        totalBytes,
        percentage: totalBytes > 0 ? Math.round(downloadedBytes / totalBytes * 100) : 0,
        speedMBps:  Math.round(speedMBps * 10) / 10,
        etaSeconds: Math.round(etaSeconds),
      };
      this.emit('downloadProgress', event);
    });

    res.pipe(file);

    file.on('finish', () => {
      file.close();
      fs.renameSync(tmpPath, destPath); // tmpを正式ファイル名に変更
      resolve();
    });

    file.on('error', (err: Error) => {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      reject(err);
    });
  }

  private updateRecord(presetId: string, updates: Partial<LocalModelRecord>): void {
    const existing = this.records.get(presetId) ?? {
      presetId,
      filePath: '',
      downloadedAt: Date.now(),
      sizeBytes: 0,
      state: 'available' as ModelState,
    };
    this.records.set(presetId, { ...existing, ...updates });
    this.saveRecords();
  }

  private recordsPath(): string {
    return path.join(this.modelsDir, 'models.json');
  }

  private loadRecords(): void {
    if (!fs.existsSync(this.recordsPath())) return;
    try {
      const data = JSON.parse(fs.readFileSync(this.recordsPath(), 'utf8')) as LocalModelRecord[];
      for (const record of data) {
        // ファイルが消えていたらstateをavailableに戻す
        if (!fs.existsSync(record.filePath)) record.state = 'available';
        this.records.set(record.presetId, record);
      }
    } catch { /* 読み込み失敗は無視 */ }
  }

  private saveRecords(): void {
    fs.writeFileSync(
      this.recordsPath(),
      JSON.stringify(Array.from(this.records.values()), null, 2),
      'utf8',
    );
  }
}

// ============================================================
// シングルトンインスタンス
// ============================================================

let _defaultManager: ModelManager | null = null;

export function getModelManager(): ModelManager {
  if (!_defaultManager) {
    _defaultManager = new ModelManager();
  }
  return _defaultManager;
}
