/**
 * Rei Kernel — Node IPC（ノード間通信）
 * 「インドラの網」プロトコル
 *
 * D-FUMT 公理対応:
 *   A1: Center-Periphery — メッセージハブ（中心）とノード群（周囲）
 *   A3: Sigma-Accumulation — 通信による相互σ蓄積
 *
 * 華厳経「インドラの網」の数学的実現:
 *   - 各ノード（宝珠）は他のノードの状態を「映す」
 *   - 映された状態が自身の計算に影響を与える
 *   - 結果がさらに他のノードに映される → 無限の相互反映
 *
 * 通信パターン:
 *   1. Point-to-Point: ノードA → ノードB（直接通信）
 *   2. Broadcast: ノードA → 同一場の全ノード（場内放送）
 *   3. LayerCast: ノードA → 同一層の全ノード（層内放送）
 *   4. Cascade: ノードA → ノードB → ノードC...（連鎖反映）
 *   5. Merge: ノードA + ノードB → 合流ノードC（結果統合）
 */

import { EventEmitter } from 'events';

// ─── 型定義 ────────────────────────────────────────────

/** メッセージ種別 */
export type MessageType =
  | 'data'          // 計算データの送信
  | 'sigma-sync'    // σ値の同期
  | 'merge-request' // 合流要求（「私の結果と統合してください」）
  | 'merge-result'  // 合流結果
  | 'cascade'       // 連鎖計算要求（「この結果で次の計算を開始して」）
  | 'reflection'    // 反映通知（「私の状態が変わりました」）
  | 'query'         // 状態問い合わせ
  | 'response'      // 問い合わせへの応答
  | 'heartbeat';    // 生存確認

/** 配信ターゲット */
export type DeliveryTarget =
  | { type: 'node'; nodeId: string }           // 特定ノード
  | { type: 'field'; fieldId: string }          // 場内全ノード
  | { type: 'layer'; layerId: number }          // 層内全ノード
  | { type: 'field-layer'; fieldId: string; layerId: number }; // 場×層

/** ノード間メッセージ */
export interface NodeMessage {
  /** メッセージ一意ID */
  id: string;
  /** 送信元ノードID */
  fromNodeId: string;
  /** 配信先 */
  target: DeliveryTarget;
  /** メッセージ種別 */
  type: MessageType;
  /** ペイロード */
  payload: any;
  /** 送信時刻 */
  timestamp: number;
  /** TTL（ホップ数制限、cascade用） */
  ttl: number;
  /** 経由ノードID（cascade追跡） */
  route: string[];
  /** 相関ID（query/response対応付け） */
  correlationId?: string;
}

/** メッセージハンドラ */
export type MessageHandler = (message: NodeMessage) => void | Promise<void>;

/** ノード登録情報 */
export interface IPCEndpoint {
  nodeId: string;
  fieldId: string;
  layerId: number;
  handlers: Map<MessageType, MessageHandler[]>;
  /** このノードへの受信キュー */
  inbox: NodeMessage[];
  /** 最終通信時刻 */
  lastSeenAt: number;
}

/** 合流（Merge）リクエスト */
export interface MergeRequest {
  /** 合流ID */
  mergeId: string;
  /** 参加ノードID群 */
  participantIds: string[];
  /** 合流条件: 何ノード集まったら実行するか */
  quorum: number;
  /** 合流関数 */
  mergeFn: (results: Map<string, any>) => any;
  /** 受信済み結果 */
  received: Map<string, any>;
  /** タイムアウト（ms） */
  timeoutMs: number;
  /** 作成時刻 */
  createdAt: number;
}

/** IPC統計 */
export interface IPCStats {
  totalEndpoints: number;
  totalMessagesSent: number;
  totalMessagesDelivered: number;
  totalMergesCompleted: number;
  totalCascadeChains: number;
  avgDeliveryTimeMs: number;
  messagesByType: Record<string, number>;
}

// ─── NodeIPC クラス ────────────────────────────────────

export class NodeIPC extends EventEmitter {
  private endpoints = new Map<string, IPCEndpoint>();
  private pendingMerges = new Map<string, MergeRequest>();
  private messageCounter = 0;
  private mergeCounter = 0;
  private stats = {
    sent: 0,
    delivered: 0,
    mergesCompleted: 0,
    cascadeChains: 0,
    deliveryTimes: [] as number[],
    messagesByType: {} as Record<string, number>,
  };
  private log: (msg: string) => void;

  constructor(log?: (msg: string) => void) {
    super();
    this.log = log || ((msg) => console.log(`[NodeIPC] ${msg}`));
  }

  // ─── エンドポイント管理 ──────────────────────────────

  /**
   * ノードをIPC空間に登録する
   */
  registerEndpoint(nodeId: string, fieldId: string, layerId: number): void {
    if (this.endpoints.has(nodeId)) return;

    this.endpoints.set(nodeId, {
      nodeId,
      fieldId,
      layerId,
      handlers: new Map(),
      inbox: [],
      lastSeenAt: Date.now(),
    });

    this.log(`Endpoint registered: ${nodeId} (field=${fieldId}, layer=${layerId})`);
    this.emit('endpoint:registered', { nodeId, fieldId, layerId });
  }

  /**
   * ノードをIPC空間から除去する
   */
  unregisterEndpoint(nodeId: string): void {
    this.endpoints.delete(nodeId);
    this.emit('endpoint:unregistered', { nodeId });
  }

  /**
   * メッセージハンドラを登録する
   */
  onMessage(nodeId: string, type: MessageType, handler: MessageHandler): void {
    const ep = this.endpoints.get(nodeId);
    if (!ep) return;

    if (!ep.handlers.has(type)) {
      ep.handlers.set(type, []);
    }
    ep.handlers.get(type)!.push(handler);
  }

  // ─── メッセージ送信 ──────────────────────────────────

  /**
   * メッセージを送信する
   */
  send(params: {
    fromNodeId: string;
    target: DeliveryTarget;
    type: MessageType;
    payload: any;
    ttl?: number;
    correlationId?: string;
  }): string {
    const msgId = `msg-${++this.messageCounter}`;
    const message: NodeMessage = {
      id: msgId,
      fromNodeId: params.fromNodeId,
      target: params.target,
      type: params.type,
      payload: params.payload,
      timestamp: Date.now(),
      ttl: params.ttl ?? 10,
      route: [params.fromNodeId],
      correlationId: params.correlationId,
    };

    this.stats.sent++;
    this.stats.messagesByType[params.type] = (this.stats.messagesByType[params.type] || 0) + 1;

    // 配信先の解決と配信
    const targets = this.resolveTargets(params.target, params.fromNodeId);
    for (const targetEp of targets) {
      this.deliver(message, targetEp);
    }

    this.emit('message:sent', { msgId, type: params.type, targetCount: targets.length });
    return msgId;
  }

  /**
   * Point-to-Point ショートカット
   */
  sendTo(fromNodeId: string, toNodeId: string, type: MessageType, payload: any): string {
    return this.send({
      fromNodeId,
      target: { type: 'node', nodeId: toNodeId },
      type,
      payload,
    });
  }

  /**
   * 場内ブロードキャスト
   */
  broadcastToField(fromNodeId: string, fieldId: string, type: MessageType, payload: any): string {
    return this.send({
      fromNodeId,
      target: { type: 'field', fieldId },
      type,
      payload,
    });
  }

  /**
   * 層内ブロードキャスト
   */
  broadcastToLayer(fromNodeId: string, layerId: number, type: MessageType, payload: any): string {
    return this.send({
      fromNodeId,
      target: { type: 'layer', layerId },
      type,
      payload,
    });
  }

  // ─── 連鎖（Cascade） ────────────────────────────────

  /**
   * 連鎖計算を開始する。
   * ノードAの結果がノードBに渡り、ノードBの結果がノードCに渡る...
   * 「拡散が別の計算を生む」構造の実装。
   */
  cascade(fromNodeId: string, chainNodeIds: string[], initialPayload: any): string {
    if (chainNodeIds.length === 0) return '';

    const cascadeId = `cascade-${++this.messageCounter}`;
    this.stats.cascadeChains++;

    // 最初のノードにcascadeメッセージを送信
    const firstTarget = chainNodeIds[0];
    return this.send({
      fromNodeId,
      target: { type: 'node', nodeId: firstTarget },
      type: 'cascade',
      payload: {
        cascadeId,
        chain: chainNodeIds.slice(1), // 残りのチェーン
        data: initialPayload,
        step: 0,
      },
      ttl: chainNodeIds.length + 1,
    });
  }

  /**
   * cascade を受信したノードが次のノードに転送する
   */
  forwardCascade(currentNodeId: string, message: NodeMessage, processedData: any): void {
    const { chain, cascadeId, step } = message.payload;

    if (!chain || chain.length === 0) {
      // チェーン終端 → 完了通知
      this.emit('cascade:complete', { cascadeId, finalData: processedData, steps: step + 1 });
      this.log(`Cascade complete: ${cascadeId} (${step + 1} steps)`);
      return;
    }

    const nextTarget = chain[0];
    this.send({
      fromNodeId: currentNodeId,
      target: { type: 'node', nodeId: nextTarget },
      type: 'cascade',
      payload: {
        cascadeId,
        chain: chain.slice(1),
        data: processedData,
        step: step + 1,
      },
      ttl: message.ttl - 1,
    });
  }

  // ─── 合流（Merge） ──────────────────────────────────

  /**
   * 複数ノードの計算結果を1つに統合する。
   * quorum数の結果が集まったら mergeFn を実行。
   */
  createMerge(params: {
    participantIds: string[];
    quorum?: number;
    mergeFn: (results: Map<string, any>) => any;
    timeoutMs?: number;
  }): string {
    const mergeId = `merge-${++this.mergeCounter}`;

    const merge: MergeRequest = {
      mergeId,
      participantIds: params.participantIds,
      quorum: params.quorum ?? params.participantIds.length,
      mergeFn: params.mergeFn,
      received: new Map(),
      timeoutMs: params.timeoutMs ?? 60000,
      createdAt: Date.now(),
    };

    this.pendingMerges.set(mergeId, merge);

    // 参加ノードにmerge-requestを送信
    for (const nodeId of params.participantIds) {
      this.send({
        fromNodeId: 'ipc-system',
        target: { type: 'node', nodeId },
        type: 'merge-request',
        payload: { mergeId, participantIds: params.participantIds },
      });
    }

    // タイムアウト設定
    setTimeout(() => {
      const pending = this.pendingMerges.get(mergeId);
      if (pending) {
        this.emit('merge:timeout', { mergeId, received: pending.received.size, quorum: pending.quorum });
        this.pendingMerges.delete(mergeId);
        this.log(`⚠ Merge timeout: ${mergeId} (${pending.received.size}/${pending.quorum})`);
      }
    }, merge.timeoutMs);

    this.log(`Merge created: ${mergeId} (participants: ${params.participantIds.length}, quorum: ${merge.quorum})`);
    return mergeId;
  }

  /**
   * merge-requestに対してノードが結果を提出する
   */
  submitMergeResult(mergeId: string, nodeId: string, result: any): void {
    const merge = this.pendingMerges.get(mergeId);
    if (!merge) return;

    merge.received.set(nodeId, result);
    this.log(`Merge result received: ${mergeId} from ${nodeId} (${merge.received.size}/${merge.quorum})`);

    // quorum 達成チェック
    if (merge.received.size >= merge.quorum) {
      try {
        const mergedResult = merge.mergeFn(merge.received);
        this.stats.mergesCompleted++;

        // 全参加ノードに結果を配信
        for (const participantId of merge.participantIds) {
          this.send({
            fromNodeId: 'ipc-system',
            target: { type: 'node', nodeId: participantId },
            type: 'merge-result',
            payload: { mergeId, result: mergedResult },
          });
        }

        this.emit('merge:complete', { mergeId, result: mergedResult });
        this.log(`✅ Merge complete: ${mergeId}`);
      } catch (err: any) {
        this.emit('merge:error', { mergeId, error: err.message });
        this.log(`❌ Merge error: ${mergeId} — ${err.message}`);
      } finally {
        this.pendingMerges.delete(mergeId);
      }
    }
  }

  // ─── 反映（Reflection）— インドラの網の核心 ─────────

  /**
   * ノードの状態変化を同一場の全ノードに反映する。
   * 「宝珠が互いを映す」の直接実装。
   */
  reflect(nodeId: string, stateSnapshot: {
    sigma: number;
    state: string;
    data?: any;
  }): void {
    const ep = this.endpoints.get(nodeId);
    if (!ep) return;

    this.send({
      fromNodeId: nodeId,
      target: { type: 'field', fieldId: ep.fieldId },
      type: 'reflection',
      payload: stateSnapshot,
    });
  }

  // ─── 内部実装 ────────────────────────────────────────

  /**
   * 配信先エンドポイントを解決する
   */
  private resolveTargets(target: DeliveryTarget, excludeNodeId: string): IPCEndpoint[] {
    const targets: IPCEndpoint[] = [];

    for (const ep of this.endpoints.values()) {
      if (ep.nodeId === excludeNodeId) continue; // 送信元を除外

      switch (target.type) {
        case 'node':
          if (ep.nodeId === target.nodeId) targets.push(ep);
          break;
        case 'field':
          if (ep.fieldId === target.fieldId) targets.push(ep);
          break;
        case 'layer':
          if (ep.layerId === target.layerId) targets.push(ep);
          break;
        case 'field-layer':
          if (ep.fieldId === target.fieldId && ep.layerId === target.layerId) targets.push(ep);
          break;
      }
    }

    return targets;
  }

  /**
   * メッセージをエンドポイントに配信する
   */
  private async deliver(message: NodeMessage, target: IPCEndpoint): Promise<void> {
    const start = Date.now();

    // TTL チェック
    if (message.ttl <= 0) {
      this.log(`Message ${message.id} dropped: TTL exhausted`);
      return;
    }

    // inboxに追加
    target.inbox.push(message);
    if (target.inbox.length > 100) {
      target.inbox = target.inbox.slice(-100); // 古いメッセージを破棄
    }
    target.lastSeenAt = Date.now();

    // ハンドラを実行
    const handlers = target.handlers.get(message.type) || [];
    for (const handler of handlers) {
      try {
        await handler(message);
      } catch (err: any) {
        this.log(`Handler error on ${target.nodeId}: ${err.message}`);
      }
    }

    this.stats.delivered++;
    const deliveryTime = Date.now() - start;
    this.stats.deliveryTimes.push(deliveryTime);
    if (this.stats.deliveryTimes.length > 1000) {
      this.stats.deliveryTimes = this.stats.deliveryTimes.slice(-1000);
    }
  }

  // ─── 統計 ────────────────────────────────────────────

  getStats(): IPCStats {
    const avgTime = this.stats.deliveryTimes.length > 0
      ? this.stats.deliveryTimes.reduce((a, b) => a + b, 0) / this.stats.deliveryTimes.length
      : 0;

    return {
      totalEndpoints: this.endpoints.size,
      totalMessagesSent: this.stats.sent,
      totalMessagesDelivered: this.stats.delivered,
      totalMergesCompleted: this.stats.mergesCompleted,
      totalCascadeChains: this.stats.cascadeChains,
      avgDeliveryTimeMs: Math.round(avgTime * 100) / 100,
      messagesByType: { ...this.stats.messagesByType },
    };
  }

  /**
   * ノードの受信キューを取得
   */
  getInbox(nodeId: string, limit = 20): NodeMessage[] {
    const ep = this.endpoints.get(nodeId);
    return ep ? ep.inbox.slice(-limit) : [];
  }

  destroy(): void {
    this.endpoints.clear();
    this.pendingMerges.clear();
    this.removeAllListeners();
  }
}
