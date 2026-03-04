/**
 * SeedTransferProtocol — 種ベース知識転送エンジン
 *
 * 圧縮カーネル（6.7%）を転送単位として：
 *   - エクスポート: 種 → 転送パッケージ（base64+メタデータ）
 *   - インポート: 転送パッケージ → 種の復元・検証・マージ
 *   - バージョン管理: セマンティックバージョニング
 *   - 差分転送: 変更分のみを転送（効率化）
 *   - 署名検証: SHA-256 チェックサムで整合性を保証
 */

import { createHash } from 'node:crypto';
import { CompressedKernel } from './compressed-kernel';
import { SEED_KERNEL, type SeedTheory } from './seed-kernel';
import type { EvolvedTheory } from './theory-evolution';

// ── 転送パッケージ ──

export interface SeedPackage {
  version: string;            // セマンティックバージョン "1.0.0"
  protocol: 'STP-1';         // プロトコル識別子（固定）
  checksum: string;           // SHA-256 チェックサム
  compressed: string;         // CompressedKernel の base64データ
  metadata: PackageMetadata;
  delta?: DeltaInfo;          // 差分転送の場合のみ
}

export interface PackageMetadata {
  theoryCount: number;        // 理論数
  generation: number;         // 世代番号
  createdAt: number;          // 作成タイムスタンプ
  source: string;             // 発行元識別子
  description?: string;       // 任意の説明
  tags?: string[];            // タグ（検索・フィルタ用）
}

export interface DeltaInfo {
  baseChecksum: string;       // 差分元のチェックサム
  addedIds: string[];         // 追加された理論ID
  removedIds: string[];       // 削除された理論ID
  modifiedIds: string[];      // 変更された理論ID
}

// ── インポート結果 ──

export interface ImportResult {
  success: boolean;
  theoryCount: number;
  newTheories: SeedTheory[];
  conflicts: ConflictEntry[];
  checksum: string;
  error?: string;
}

export interface ConflictEntry {
  id: string;
  existing: SeedTheory;
  incoming: SeedTheory;
  resolution: 'keep_existing' | 'use_incoming' | 'merge';
}

// ── SeedTransferProtocol 本体 ──

export class SeedTransferProtocol {
  private readonly kernel = new CompressedKernel();
  private readonly source: string;

  constructor(source = 'rei-aios') {
    this.source = source;
  }

  /**
   * 現在のカーネルをパッケージ化してエクスポート
   */
  export(options: {
    version?: string;
    description?: string;
    tags?: string[];
    generation?: number;
    theories?: SeedTheory[];  // 指定なければ SEED_KERNEL
  } = {}): SeedPackage {
    const theories = options.theories ?? SEED_KERNEL;
    const compressed = this.compressTheories(theories);
    const checksum = this.sha256(compressed);

    return {
      version: options.version ?? '1.0.0',
      protocol: 'STP-1',
      checksum,
      compressed,
      metadata: {
        theoryCount: theories.length,
        generation: options.generation ?? 0,
        createdAt: Date.now(),
        source: this.source,
        description: options.description,
        tags: options.tags,
      },
    };
  }

  /**
   * 差分パッケージを生成（変更分のみ転送）
   */
  exportDelta(
    basePackage: SeedPackage,
    currentTheories: SeedTheory[],
    options: { version?: string } = {},
  ): SeedPackage {
    const baseTheories = this.decompress(basePackage.compressed);
    const baseIds = new Set(baseTheories.map(t => t.id));
    const currentIds = new Set(currentTheories.map(t => t.id));

    const addedIds = currentTheories
      .filter(t => !baseIds.has(t.id)).map(t => t.id);
    const removedIds = baseTheories
      .filter(t => !currentIds.has(t.id)).map(t => t.id);
    const modifiedIds = currentTheories
      .filter(t => {
        const base = baseTheories.find(b => b.id === t.id);
        return base && JSON.stringify(base) !== JSON.stringify(t);
      }).map(t => t.id);

    // 差分対象の理論のみ圧縮
    const deltaTheories = currentTheories.filter(t =>
      addedIds.includes(t.id) || modifiedIds.includes(t.id)
    );
    const compressed = this.compressTheories(
      deltaTheories.length > 0 ? deltaTheories : currentTheories
    );
    const checksum = this.sha256(compressed);

    return {
      version: options.version ?? '1.0.1',
      protocol: 'STP-1',
      checksum,
      compressed,
      metadata: {
        theoryCount: deltaTheories.length,
        generation: (basePackage.metadata.generation ?? 0) + 1,
        createdAt: Date.now(),
        source: this.source,
        description: `Delta from ${basePackage.checksum.slice(0, 8)}`,
      },
      delta: {
        baseChecksum: basePackage.checksum,
        addedIds,
        removedIds,
        modifiedIds,
      },
    };
  }

  /**
   * パッケージをインポートして種を復元・検証
   */
  import(
    pkg: SeedPackage,
    conflictResolution: 'keep_existing' | 'use_incoming' | 'merge' = 'keep_existing',
  ): ImportResult {
    // プロトコル確認
    if (pkg.protocol !== 'STP-1') {
      return { success: false, theoryCount: 0, newTheories: [], conflicts: [],
        checksum: '', error: `Unknown protocol: ${pkg.protocol}` };
    }

    // チェックサム検証
    const actualChecksum = this.sha256(pkg.compressed);
    if (actualChecksum !== pkg.checksum) {
      return { success: false, theoryCount: 0, newTheories: [], conflicts: [],
        checksum: actualChecksum, error: 'Checksum mismatch' };
    }

    // 展開
    const incoming = this.decompress(pkg.compressed);
    const existingIds = new Set(SEED_KERNEL.map(s => s.id));
    const newTheories: SeedTheory[] = [];
    const conflicts: ConflictEntry[] = [];

    for (const theory of incoming) {
      if (!existingIds.has(theory.id)) {
        newTheories.push(theory);
      } else {
        const existing = SEED_KERNEL.find(s => s.id === theory.id)!;
        if (JSON.stringify(existing) !== JSON.stringify(theory)) {
          conflicts.push({ id: theory.id, existing, incoming: theory, resolution: conflictResolution });
        }
      }
    }

    return {
      success: true,
      theoryCount: incoming.length,
      newTheories,
      conflicts,
      checksum: actualChecksum,
    };
  }

  /**
   * パッケージをJSON文字列にシリアライズ
   */
  serialize(pkg: SeedPackage): string {
    return JSON.stringify(pkg);
  }

  /**
   * JSON文字列からパッケージを復元
   */
  deserialize(json: string): SeedPackage {
    const pkg = JSON.parse(json) as SeedPackage;
    if (pkg.protocol !== 'STP-1') throw new Error(`Invalid protocol: ${pkg.protocol}`);
    return pkg;
  }

  /**
   * パッケージの概要を返す
   */
  inspect(pkg: SeedPackage): {
    version: string;
    theories: number;
    size: number;
    checksumShort: string;
    isDelta: boolean;
    age: string;
  } {
    const ageMs = Date.now() - pkg.metadata.createdAt;
    const ageSec = Math.floor(ageMs / 1000);

    return {
      version: pkg.version,
      theories: pkg.metadata.theoryCount,
      size: Buffer.byteLength(pkg.compressed, 'utf-8'),
      checksumShort: pkg.checksum.slice(0, 12),
      isDelta: !!pkg.delta,
      age: ageSec < 60 ? `${ageSec}s ago` : `${Math.floor(ageSec / 60)}m ago`,
    };
  }

  // ── プライベートメソッド ──

  private compressTheories(theories: SeedTheory[]): string {
    // CompressedKernel を直接使う場合はそちらを使用
    // ここでは簡易JSON圧縮
    return Buffer.from(JSON.stringify(theories)).toString('base64');
  }

  private decompress(compressed: string): SeedTheory[] {
    return JSON.parse(Buffer.from(compressed, 'base64').toString('utf-8')) as SeedTheory[];
  }

  private sha256(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }
}
