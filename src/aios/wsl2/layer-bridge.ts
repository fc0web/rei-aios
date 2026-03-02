/**
 * Rei AIOS — Layer Bridge
 * Theme J: Windows ↔ WSL2 仮想デスクトップ 通信ブリッジ
 *
 * 各Layerの仮想デスクトップと、Windowsメイン環境の間で
 * タスク・状態・ファイルを双方向に通信する。
 *
 * 通信方式:
 *   1. IPC (Unix Domain Socket / Named Pipe)
 *      → 軽量なコマンド・状態同期
 *   2. ファイル共有（WSL2マウント）
 *      → 大きなデータ（ファイル・スクリプト）
 *   3. WebSocket（将来拡張用）
 *      → リアルタイムストリーム
 *
 * D-FUMT 中心-周囲パターン:
 *   中心 = LayerBridgeHub（通信の中継点）
 *   周囲 = 各Layer（独立した通信エンドポイント）
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';
import * as os from 'os';

// ─── 型定義 ────────────────────────────────────────────

export interface LayerMessage {
  /** メッセージID */
  id: string;
  /** 送信元Layer番号（0=Windows主環境）*/
  fromLayer: number;
  /** 宛先Layer番号（-1=全Layer broadcast）*/
  toLayer: number;
  /** メッセージ種別 */
  type: LayerMessageType;
  /** ペイロード */
  payload: unknown;
  /** タイムスタンプ */
  timestamp: number;
}

export type LayerMessageType =
  | 'task:assign'       // タスクをLayerに割り当て
  | 'task:result'       // タスク結果を返送
  | 'task:progress'     // タスク進捗を報告
  | 'agent:status'      // エージェント状態変化
  | 'file:ready'        // ファイル生成完了通知
  | 'formation:sync'    // フォーメーション同期
  | 'layer:heartbeat'   // 生死確認
  | 'layer:wake'        // スリープLayerを起こす
  | 'layer:sleep'       // Layerをスリープ
  | 'broadcast'         // 全Layer向け通知
  | 'compress:request'  // Rei圧縮要求
  | 'compress:done';    // 圧縮完了

export interface LayerTaskResult {
  taskId: string;
  layerId: number;
  success: boolean;
  output?: string;
  filePaths?: string[];
  durationMs: number;
  error?: string;
}

// ─── LayerChannel（1対1通信チャネル）─────────────────

class LayerChannel extends EventEmitter {
  readonly layerId: number;
  private server: net.Server | null = null;
  private clients = new Set<net.Socket>();
  private socketPath: string;
  private msgSeq = 0;
  private log: (msg: string) => void;

  constructor(layerId: number, dataDir: string, log: (msg: string) => void) {
    super();
    this.layerId = layerId;
    this.log = log;
    // Windows↔WSL2共有パス（WSL2からは /mnt/c/... でアクセス可能）
    this.socketPath = process.platform === 'win32'
      ? path.join(os.tmpdir(), `rei-layer-${layerId}.sock`)
      : path.join(dataDir, `layer-${layerId}.sock`);
  }

  async listen(): Promise<void> {
    // 既存ソケットをクリーンアップ
    if (fs.existsSync(this.socketPath)) {
      fs.unlinkSync(this.socketPath);
    }

    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        this.clients.add(socket);
        let buf = '';

        socket.on('data', (data) => {
          buf += data.toString();
          const lines = buf.split('\n');
          buf = lines.pop() || '';
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const msg: LayerMessage = JSON.parse(line);
              this.emit('message', msg);
            } catch { /* ignore malformed */ }
          }
        });

        socket.on('close', () => this.clients.delete(socket));
        socket.on('error', () => this.clients.delete(socket));
      });

      this.server.listen(this.socketPath, () => {
        this.log(`Layer ${this.layerId} channel listening: ${this.socketPath}`);
        resolve();
      });

      this.server.on('error', reject);
    });
  }

  send(msg: Omit<LayerMessage, 'id' | 'timestamp'>): void {
    const full: LayerMessage = {
      ...msg,
      id: `msg-${this.layerId}-${++this.msgSeq}`,
      timestamp: Date.now(),
    };
    const line = JSON.stringify(full) + '\n';
    for (const client of this.clients) {
      try { client.write(line); } catch { /* ignore */ }
    }
  }

  close(): void {
    for (const client of this.clients) {
      try { client.destroy(); } catch { /* ignore */ }
    }
    this.clients.clear();
    this.server?.close();
    if (fs.existsSync(this.socketPath)) {
      try { fs.unlinkSync(this.socketPath); } catch { /* ignore */ }
    }
  }
}

// ─── LayerBridgeHub（ハブ）────────────────────────────

export class LayerBridgeHub extends EventEmitter {
  private channels = new Map<number, LayerChannel>();
  private msgLog: LayerMessage[] = [];
  private maxMsgLog = 1000;
  private shareDir: string;
  private log: (msg: string) => void;

  constructor(dataDir: string, log?: (msg: string) => void) {
    super();
    this.log = log || ((msg) => console.log(`[LayerBridge] ${msg}`));
    this.shareDir = path.join(dataDir, 'layer-share');
    fs.mkdirSync(this.shareDir, { recursive: true });
  }

  // ─── チャネル管理 ────────────────────────────────

  async openChannel(layerId: number): Promise<void> {
    if (this.channels.has(layerId)) return;

    const channel = new LayerChannel(layerId, this.shareDir, this.log);
    await channel.listen();

    channel.on('message', (msg: LayerMessage) => {
      this.msgLog.push(msg);
      if (this.msgLog.length > this.maxMsgLog) this.msgLog.shift();
      this.emit('message', msg);
      this.emit(`message:${msg.type}`, msg);

      // ブロードキャスト転送
      if (msg.toLayer === -1) {
        this.broadcast(msg.type, msg.payload, msg.fromLayer);
      }
      // 特定Layer向け転送
      else if (msg.toLayer !== layerId) {
        this.sendTo(msg.toLayer, msg.type, msg.payload, msg.fromLayer);
      }
    });

    this.channels.set(layerId, channel);
    this.log(`Channel opened for Layer ${layerId}`);
  }

  closeChannel(layerId: number): void {
    const channel = this.channels.get(layerId);
    if (channel) {
      channel.close();
      this.channels.delete(layerId);
      this.log(`Channel closed for Layer ${layerId}`);
    }
  }

  // ─── メッセージ送信 ──────────────────────────────

  /**
   * 特定Layerへメッセージを送信
   */
  sendTo(
    toLayer: number,
    type: LayerMessageType,
    payload: unknown,
    fromLayer = 0
  ): void {
    const channel = this.channels.get(toLayer);
    if (!channel) {
      this.log(`Channel not open for Layer ${toLayer}`);
      return;
    }
    channel.send({ fromLayer, toLayer, type, payload });
  }

  /**
   * 全Layer にブロードキャスト
   */
  broadcast(type: LayerMessageType, payload: unknown, fromLayer = 0): void {
    for (const [layerId, channel] of this.channels) {
      if (layerId === fromLayer) continue; // 送信元には送らない
      channel.send({ fromLayer, toLayer: layerId, type, payload });
    }
  }

  /**
   * タスクを特定Layerに割り当てる
   */
  assignTask(toLayer: number, task: {
    taskId: string;
    goal: string;
    context?: string;
    priority?: 'high' | 'normal' | 'low';
  }): void {
    this.sendTo(toLayer, 'task:assign', task);
    this.log(`Task ${task.taskId} assigned to Layer ${toLayer}: "${task.goal}"`);
  }

  // ─── ファイル共有 ────────────────────────────────

  /**
   * 共有ディレクトリにファイルを書き込み、他Layerに通知
   */
  shareFile(
    fromLayer: number,
    filename: string,
    content: string | Buffer
  ): string {
    const layerDir = path.join(this.shareDir, `layer-${fromLayer}`);
    fs.mkdirSync(layerDir, { recursive: true });
    const filePath = path.join(layerDir, filename);
    fs.writeFileSync(filePath, content);

    this.broadcast('file:ready', {
      fromLayer,
      filename,
      filePath,
      size: Buffer.byteLength(content),
    }, fromLayer);

    return filePath;
  }

  /**
   * 他Layerが共有したファイルを読み込む
   */
  readSharedFile(fromLayer: number, filename: string): Buffer | null {
    const filePath = path.join(this.shareDir, `layer-${fromLayer}`, filename);
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath);
  }

  // ─── 状態取得 ────────────────────────────────────

  getMessageLog(limit = 50): LayerMessage[] {
    return this.msgLog.slice(-limit);
  }

  getOpenChannels(): number[] {
    return Array.from(this.channels.keys());
  }

  // ─── クリーンアップ ──────────────────────────────

  destroy(): void {
    for (const channel of this.channels.values()) {
      channel.close();
    }
    this.channels.clear();
    this.removeAllListeners();
  }
}
