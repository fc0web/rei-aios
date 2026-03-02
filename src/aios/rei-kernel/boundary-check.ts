/**
 * Rei Kernel — Boundary Check（層間境界検査）
 *
 * D-FUMT 公理対応:
 *   A1: Center-Periphery — 各層は独自の中心-周囲構造を持つ
 *   A2: Extension-Reduction — 層を跨ぐデータは拡張/縮約が必要な場合がある
 *
 * 目的:
 *   メモリ保護のアナロジー。従来のOSではプロセスAが
 *   プロセスBのメモリを書き換えないように保護する。
 *   Reiでは「層0の結論を層2にそのまま持ち込んでよいか」
 *   を公理的に検証する。
 *
 * 検査項目:
 *   1. 型互換性（Type Compatibility）
 *   2. σ範囲検証（Sigma Range Validation）
 *   3. κ安全性（Kappa Safety Check）
 *   4. 公理的整合性（Axiom Consistency）
 *   5. 層方向制約（Layer Direction Constraint）
 */

import { EventEmitter } from 'events';

// ─── 型定義 ────────────────────────────────────────────

/** 層間で転送されるデータの型 */
export type TransferDataType =
  | 'number'
  | 'string'
  | 'sigma'     // σ値
  | 'node-state' // ノード状態
  | 'computation-result' // 計算結果
  | 'command'   // 制御コマンド
  | 'raw';      // 未分類データ

/** 層間転送リクエスト */
export interface LayerTransfer {
  /** 転送ID */
  id: string;
  /** 送信元層 */
  fromLayerId: number;
  /** 送信先層 */
  toLayerId: number;
  /** 送信元ノードID */
  fromNodeId: string;
  /** 送信先ノードID（optional: broadcast可） */
  toNodeId?: string;
  /** データ型 */
  dataType: TransferDataType;
  /** ペイロード */
  payload: any;
  /** 送信時のσ値 */
  sigma: number;
  /** 送信時のκ値 */
  kappa: number;
  /** 転送理由 */
  reason: string;
  /** タイムスタンプ */
  timestamp: number;
}

/** 検査結果 */
export interface BoundaryCheckResult {
  transferId: string;
  allowed: boolean;
  checks: CheckDetail[];
  /** 変換が必要な場合の変換関数名 */
  transformRequired?: string;
  /** 拒否理由 */
  denyReason?: string;
}

/** 個別検査の詳細 */
export interface CheckDetail {
  name: string;
  passed: boolean;
  message: string;
}

/** 層の定義（公理的文脈） */
export interface LayerDefinition {
  id: number;
  name: string;
  /** この層が受け入れるデータ型 */
  acceptedTypes: TransferDataType[];
  /** σの有効範囲 */
  sigmaRange: { min: number; max: number };
  /** κの安全閾値（これ以上の影響度は追加承認が必要） */
  kappaThreshold: number;
  /** 上位層への転送を許可するか */
  allowUpward: boolean;
  /** 下位層への転送を許可するか */
  allowDownward: boolean;
  /** カスタム検証関数 */
  customValidator?: (transfer: LayerTransfer) => CheckDetail;
}

/** 境界検査ポリシー */
export interface BoundaryPolicy {
  /** 隣接層のみ転送可能（1層ジャンプ制限） */
  adjacentOnly: boolean;
  /** σ範囲外の自動クランプを許可 */
  autoClampSigma: boolean;
  /** 高κ転送の自動承認閾値（これ以下なら自動承認） */
  autoApproveKappaBelow: number;
  /** 未定義層への転送を許可 */
  allowUndefinedLayers: boolean;
  /** ログを記録するか */
  auditLog: boolean;
}

const DEFAULT_POLICY: BoundaryPolicy = {
  adjacentOnly: false,      // 非隣接層間の転送も許可
  autoClampSigma: true,     // σ範囲外は自動クランプ
  autoApproveKappaBelow: 0.5,
  allowUndefinedLayers: false,
  auditLog: true,
};

// ─── デフォルト層定義（Rei 5層構造に対応） ─────────────

const DEFAULT_LAYERS: LayerDefinition[] = [
  {
    id: 0,
    name: '表層（Surface）',
    acceptedTypes: ['string', 'number', 'command', 'raw'],
    sigmaRange: { min: 0, max: 1 },
    kappaThreshold: 0.8,
    allowUpward: false,   // 最上位
    allowDownward: true,
  },
  {
    id: 1,
    name: '対話層（Dialogue）',
    acceptedTypes: ['string', 'number', 'sigma', 'node-state', 'command'],
    sigmaRange: { min: 0, max: 1 },
    kappaThreshold: 0.7,
    allowUpward: true,
    allowDownward: true,
  },
  {
    id: 2,
    name: '構造層（Structural）',
    acceptedTypes: ['sigma', 'node-state', 'computation-result', 'command'],
    sigmaRange: { min: 0, max: 1 },
    kappaThreshold: 0.6,
    allowUpward: true,
    allowDownward: true,
  },
  {
    id: 3,
    name: '意味層（Semantic）',
    acceptedTypes: ['sigma', 'node-state', 'computation-result'],
    sigmaRange: { min: 0, max: 1 },
    kappaThreshold: 0.5,
    allowUpward: true,
    allowDownward: true,
  },
  {
    id: 4,
    name: '深層（Deep）',
    acceptedTypes: ['sigma', 'computation-result'],
    sigmaRange: { min: 0, max: 1 },
    kappaThreshold: 0.3,
    allowUpward: true,
    allowDownward: false,  // 最下位
  },
];

// ─── BoundaryCheck クラス ──────────────────────────────

export class BoundaryCheck extends EventEmitter {
  private layers = new Map<number, LayerDefinition>();
  private policy: BoundaryPolicy;
  private log: (msg: string) => void;
  private transferCounter = 0;
  private auditLog: Array<{
    transferId: string;
    from: number;
    to: number;
    allowed: boolean;
    reason: string;
    timestamp: number;
  }> = [];

  constructor(
    customLayers?: LayerDefinition[],
    policy?: Partial<BoundaryPolicy>,
    log?: (msg: string) => void
  ) {
    super();
    this.policy = { ...DEFAULT_POLICY, ...policy };
    this.log = log || ((msg) => console.log(`[BoundaryCheck] ${msg}`));

    // 層定義の登録
    const layerDefs = customLayers || DEFAULT_LAYERS;
    for (const layer of layerDefs) {
      this.layers.set(layer.id, layer);
    }
  }

  // ─── 層定義管理 ──────────────────────────────────────

  defineLayer(layer: LayerDefinition): void {
    this.layers.set(layer.id, layer);
    this.log(`Layer defined: ${layer.id} (${layer.name})`);
  }

  getLayerDefinition(layerId: number): LayerDefinition | undefined {
    return this.layers.get(layerId);
  }

  // ─── 境界検査 ────────────────────────────────────────

  /**
   * 層間転送が許可されるか検査する。
   * 全検査をパスしない限り転送は拒否される。
   */
  check(transfer: LayerTransfer): BoundaryCheckResult {
    const checks: CheckDetail[] = [];
    let allowed = true;

    // 1. 層存在チェック
    const fromLayer = this.layers.get(transfer.fromLayerId);
    const toLayer = this.layers.get(transfer.toLayerId);

    if (!fromLayer && !this.policy.allowUndefinedLayers) {
      checks.push({ name: 'source-layer-exists', passed: false, message: `送信元層 ${transfer.fromLayerId} は未定義` });
      allowed = false;
    } else {
      checks.push({ name: 'source-layer-exists', passed: true, message: 'OK' });
    }

    if (!toLayer && !this.policy.allowUndefinedLayers) {
      checks.push({ name: 'target-layer-exists', passed: false, message: `送信先層 ${transfer.toLayerId} は未定義` });
      allowed = false;
    } else {
      checks.push({ name: 'target-layer-exists', passed: true, message: 'OK' });
    }

    if (!fromLayer || !toLayer) {
      return this.buildResult(transfer, allowed, checks);
    }

    // 2. 方向制約チェック
    const isUpward = transfer.toLayerId < transfer.fromLayerId;
    const isDownward = transfer.toLayerId > transfer.fromLayerId;

    if (isUpward && !fromLayer.allowUpward) {
      checks.push({ name: 'direction-upward', passed: false, message: `層${transfer.fromLayerId}からの上方転送は禁止` });
      allowed = false;
    } else if (isDownward && !fromLayer.allowDownward) {
      checks.push({ name: 'direction-downward', passed: false, message: `層${transfer.fromLayerId}からの下方転送は禁止` });
      allowed = false;
    } else {
      checks.push({ name: 'direction', passed: true, message: isUpward ? '上方転送OK' : isDownward ? '下方転送OK' : '同一層' });
    }

    // 3. 隣接制約チェック
    if (this.policy.adjacentOnly) {
      const distance = Math.abs(transfer.toLayerId - transfer.fromLayerId);
      if (distance > 1) {
        checks.push({ name: 'adjacent-only', passed: false, message: `非隣接転送: 距離=${distance}` });
        allowed = false;
      } else {
        checks.push({ name: 'adjacent-only', passed: true, message: 'OK' });
      }
    }

    // 4. 型互換性チェック
    if (!toLayer.acceptedTypes.includes(transfer.dataType)) {
      checks.push({
        name: 'type-compatibility',
        passed: false,
        message: `層${transfer.toLayerId}は型'${transfer.dataType}'を受け入れません (許可: ${toLayer.acceptedTypes.join(', ')})`,
      });
      allowed = false;
    } else {
      checks.push({ name: 'type-compatibility', passed: true, message: 'OK' });
    }

    // 5. σ範囲検証
    const sigmaCheck = this.checkSigmaRange(transfer.sigma, toLayer.sigmaRange);
    checks.push(sigmaCheck);
    if (!sigmaCheck.passed && !this.policy.autoClampSigma) {
      allowed = false;
    }

    // 6. κ安全性チェック
    if (transfer.kappa > toLayer.kappaThreshold) {
      if (transfer.kappa <= this.policy.autoApproveKappaBelow) {
        checks.push({
          name: 'kappa-safety',
          passed: true,
          message: `κ=${transfer.kappa} > threshold=${toLayer.kappaThreshold} だが自動承認閾値内`,
        });
      } else {
        checks.push({
          name: 'kappa-safety',
          passed: false,
          message: `κ=${transfer.kappa} が安全閾値 ${toLayer.kappaThreshold} を超過（追加承認が必要）`,
        });
        allowed = false;
      }
    } else {
      checks.push({ name: 'kappa-safety', passed: true, message: `κ=${transfer.kappa} ≤ ${toLayer.kappaThreshold}` });
    }

    // 7. カスタム検証
    if (toLayer.customValidator) {
      const customCheck = toLayer.customValidator(transfer);
      checks.push(customCheck);
      if (!customCheck.passed) {
        allowed = false;
      }
    }

    return this.buildResult(transfer, allowed, checks);
  }

  /**
   * 転送を検査し、許可された場合にペイロードを変換して返す。
   * σ範囲外の場合は自動クランプを適用。
   */
  validateAndTransform(transfer: LayerTransfer): {
    allowed: boolean;
    result: BoundaryCheckResult;
    transformedPayload?: any;
  } {
    const result = this.check(transfer);

    if (!result.allowed) {
      return { allowed: false, result };
    }

    let transformedPayload = transfer.payload;

    // σ自動クランプ
    if (this.policy.autoClampSigma) {
      const toLayer = this.layers.get(transfer.toLayerId);
      if (toLayer && (transfer.sigma < toLayer.sigmaRange.min || transfer.sigma > toLayer.sigmaRange.max)) {
        const clamped = Math.max(toLayer.sigmaRange.min, Math.min(toLayer.sigmaRange.max, transfer.sigma));
        this.log(`  σ auto-clamped: ${transfer.sigma} → ${clamped}`);
        // ペイロード内のσ値も更新
        if (typeof transformedPayload === 'object' && transformedPayload !== null) {
          transformedPayload = { ...transformedPayload, sigma: clamped, _originalSigma: transfer.sigma };
        }
      }
    }

    return { allowed: true, result, transformedPayload };
  }

  // ─── 内部実装 ────────────────────────────────────────

  private checkSigmaRange(sigma: number, range: { min: number; max: number }): CheckDetail {
    if (sigma >= range.min && sigma <= range.max) {
      return { name: 'sigma-range', passed: true, message: `σ=${sigma} ∈ [${range.min}, ${range.max}]` };
    }
    return {
      name: 'sigma-range',
      passed: false,
      message: `σ=${sigma} ∉ [${range.min}, ${range.max}]${this.policy.autoClampSigma ? ' (自動クランプ適用)' : ''}`,
    };
  }

  private buildResult(transfer: LayerTransfer, allowed: boolean, checks: CheckDetail[]): BoundaryCheckResult {
    const result: BoundaryCheckResult = {
      transferId: transfer.id || `transfer-${++this.transferCounter}`,
      allowed,
      checks,
    };

    if (!allowed) {
      const failedChecks = checks.filter(c => !c.passed);
      result.denyReason = failedChecks.map(c => c.message).join('; ');
    }

    // 監査ログ
    if (this.policy.auditLog) {
      this.auditLog.push({
        transferId: result.transferId,
        from: transfer.fromLayerId,
        to: transfer.toLayerId,
        allowed,
        reason: allowed ? 'all checks passed' : result.denyReason || 'unknown',
        timestamp: Date.now(),
      });

      if (this.auditLog.length > 1000) {
        this.auditLog = this.auditLog.slice(-1000);
      }
    }

    this.emit(allowed ? 'transfer:allowed' : 'transfer:denied', result);
    if (!allowed) {
      this.log(`🚫 Transfer denied: L${transfer.fromLayerId}→L${transfer.toLayerId} — ${result.denyReason}`);
    }

    return result;
  }

  // ─── 照会API ────────────────────────────────────────

  /**
   * 転送リクエストを作成するヘルパー
   */
  createTransfer(params: Omit<LayerTransfer, 'id' | 'timestamp'>): LayerTransfer {
    return {
      ...params,
      id: `transfer-${++this.transferCounter}`,
      timestamp: Date.now(),
    };
  }

  getAuditLog(limit = 50): typeof this.auditLog {
    return this.auditLog.slice(-limit);
  }

  getStats(): {
    totalChecks: number;
    allowed: number;
    denied: number;
    denialRate: number;
    byLayerPair: Record<string, { allowed: number; denied: number }>;
  } {
    const byPair: Record<string, { allowed: number; denied: number }> = {};
    let allowedCount = 0;
    let deniedCount = 0;

    for (const entry of this.auditLog) {
      const key = `L${entry.from}→L${entry.to}`;
      if (!byPair[key]) byPair[key] = { allowed: 0, denied: 0 };
      if (entry.allowed) {
        byPair[key].allowed++;
        allowedCount++;
      } else {
        byPair[key].denied++;
        deniedCount++;
      }
    }

    const total = allowedCount + deniedCount;
    return {
      totalChecks: total,
      allowed: allowedCount,
      denied: deniedCount,
      denialRate: total > 0 ? deniedCount / total : 0,
      byLayerPair: byPair,
    };
  }

  destroy(): void {
    this.layers.clear();
    this.auditLog = [];
    this.removeAllListeners();
  }
}
