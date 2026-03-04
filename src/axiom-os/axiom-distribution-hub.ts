import { DistributedAxiomPipeline, type AxiomNode } from './distributed-axiom-pipeline';
import { SeedTransferProtocol, type SeedPackage } from './seed-transfer';
import { type SeedTheory } from './seed-kernel';

// ハブの状態
export interface HubStatus {
  totalNodes: number;
  totalAxioms: number;
  packages: number;
  lastUpdated: Date;
  sevenLogicState: string;
}

export class AxiomDistributionHub {
  private pipeline = new DistributedAxiomPipeline();
  private transfer = new SeedTransferProtocol();
  private storedPackages: SeedPackage[] = [];
  private globalAxioms: SeedTheory[] = [];

  // ノード群から公理抽出→パッケージ化→保存
  publish(nodes: AxiomNode[], version = '1.0.0'): SeedPackage {
    const result = this.pipeline.run(nodes);
    const allAxioms = [
      ...result.consensusAxioms,
      ...result.pendingAxioms,
    ];

    // 重複を除いてglobalAxiomsに追加
    for (const axiom of allAxioms) {
      if (!this.globalAxioms.find(a => a.id === axiom.id)) {
        this.globalAxioms.push(axiom);
      }
    }

    // SeedTransferProtocolでパッケージ化
    const pkg = this.transfer.export({
      theories: this.globalAxioms,
      version,
      tags: [`distributed-${nodes.map(n => n.id).join('-')}`],
    });
    this.storedPackages.push(pkg);
    return pkg;
  }

  // シングルノードから公理を追加
  publishSingle(code: string, nodeId = 'local', version = '1.0.0'): SeedPackage {
    const result = this.pipeline.runSingle(code, nodeId);
    const allAxioms = [...result.consensusAxioms, ...result.pendingAxioms];

    for (const axiom of allAxioms) {
      if (!this.globalAxioms.find(a => a.id === axiom.id)) {
        this.globalAxioms.push(axiom);
      }
    }

    const pkg = this.transfer.export({
      theories: this.globalAxioms,
      version,
      tags: [nodeId],
    });
    this.storedPackages.push(pkg);
    return pkg;
  }

  // パッケージを受信してグローバル公理にマージ
  receive(pkg: SeedPackage): { merged: number; skipped: number } {
    const result = this.transfer.import(pkg);
    let merged = 0, skipped = 0;

    if (!result.success) return { merged: 0, skipped: 0 };

    for (const theory of result.newTheories) {
      if (!this.globalAxioms.find(a => a.id === theory.id)) {
        this.globalAxioms.push(theory);
        merged++;
      } else {
        skipped++;
      }
    }
    return { merged, skipped };
  }

  // 差分パッケージ生成（前回からの変更分のみ）
  exportDelta(sinceVersion: string, version: string): SeedPackage {
    // 指定バージョンのパッケージを探す（なければ最初のパッケージ）
    const basePkg = this.storedPackages.find(p => p.version === sinceVersion)
      ?? this.storedPackages[0];

    if (!basePkg) {
      // ベースパッケージがない場合はフルエクスポート
      return this.transfer.export({
        theories: this.globalAxioms,
        version,
      });
    }

    return this.transfer.exportDelta(basePkg, this.globalAxioms, { version });
  }

  // 全グローバル公理を取得
  getGlobalAxioms(): SeedTheory[] {
    return [...this.globalAxioms];
  }

  // ハブ状態を取得
  getStatus(): HubStatus {
    return {
      totalNodes: this.storedPackages.length,
      totalAxioms: this.globalAxioms.length,
      packages: this.storedPackages.length,
      lastUpdated: new Date(),
      sevenLogicState: this.globalAxioms.length > 10 ? '⊤ 高密度' :
                       this.globalAxioms.length > 5  ? '～ 成長中' : '〇 初期',
    };
  }
}
