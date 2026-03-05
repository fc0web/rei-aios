import { createHash } from 'crypto';
import { type SeedTheory } from './seed-kernel';

export interface ContentAddressedAxiom extends SeedTheory {
  cid: string;          // IPFS式コンテンツID
  cidVersion: 'v0';     // CIDバージョン
  multihash: string;    // SHA-256ハッシュ
  size: number;         // シリアライズ後のバイト数
}

export class AxiomContentAddressor {
  // SeedTheoryにCIDを付与
  address(axiom: SeedTheory): ContentAddressedAxiom {
    const canonical = this.canonicalize(axiom);
    const bytes = Buffer.from(canonical, 'utf-8');
    const multihash = createHash('sha256').update(bytes).digest('hex');
    const cid = 'Qm' + multihash.substring(0, 44);

    return {
      ...axiom,
      cid,
      cidVersion: 'v0',
      multihash,
      size: bytes.length,
    };
  }

  // 複数公理を一括アドレス化
  addressAll(axioms: SeedTheory[]): ContentAddressedAxiom[] {
    return axioms.map(a => this.address(a));
  }

  // 同一性検証（内容が同じならCIDが一致するはず）
  verify(axiom: ContentAddressedAxiom): boolean {
    const recomputed = this.address(axiom);
    return recomputed.cid === axiom.cid;
  }

  // 共通公理の検出（2つのリストのCIDが一致するもの）
  findCommon(
    listA: ContentAddressedAxiom[],
    listB: ContentAddressedAxiom[]
  ): ContentAddressedAxiom[] {
    const cidSetB = new Set(listB.map(a => a.cid));
    return listA.filter(a => cidSetB.has(a.cid));
  }

  // 正規化（同じ内容なら同じ文字列になるように）
  private canonicalize(axiom: SeedTheory): string {
    return JSON.stringify({
      axiom: axiom.axiom.trim(),
      keywords: [...axiom.keywords].sort(),
      category: axiom.category,
      // IDや生成日時は除外（内容のみで識別）
    });
  }
}
