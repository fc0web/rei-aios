import { type SeedTheory } from './seed-kernel';

export type SubnetCategory =
  | 'computation' | 'mathematics' | 'logic'
  | 'expansion' | 'zero_extension' | 'unified' | 'general';

export interface SubnetNode {
  nodeId: string;
  categories: SubnetCategory[];
  axiomCount: number;
  connectedPeers: string[];
}

export class AxiomSubnet {
  private subnets = new Map<SubnetCategory, Map<string, SubnetNode>>();
  private nodes = new Map<string, SubnetNode>();

  // ノードをサブネットに登録
  join(nodeId: string, axioms: SeedTheory[]): SubnetNode {
    // 保持公理のカテゴリを集計
    const categoryCount = new Map<string, number>();
    for (const a of axioms) {
      const cat = a.category as SubnetCategory;
      categoryCount.set(cat, (categoryCount.get(cat) ?? 0) + 1);
    }

    // 上位カテゴリに参加
    const categories = [...categoryCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat]) => cat as SubnetCategory);

    const node: SubnetNode = {
      nodeId,
      categories,
      axiomCount: axioms.length,
      connectedPeers: [],
    };

    this.nodes.set(nodeId, node);

    for (const cat of categories) {
      if (!this.subnets.has(cat)) {
        this.subnets.set(cat, new Map());
      }
      this.subnets.get(cat)!.set(nodeId, node);
    }

    // 同カテゴリのノードと自動接続
    this.autoConnect(node);
    return node;
  }

  // 同カテゴリのノードを優先的に返す
  findPeers(nodeId: string, category: SubnetCategory, k: number = 5): SubnetNode[] {
    const subnet = this.subnets.get(category);
    if (!subnet) return [];
    return [...subnet.values()]
      .filter(n => n.nodeId !== nodeId)
      .slice(0, k);
  }

  // 特定カテゴリの公理を持つノード検索
  findByCategory(category: SubnetCategory): SubnetNode[] {
    return [...(this.subnets.get(category)?.values() ?? [])];
  }

  private autoConnect(node: SubnetNode): void {
    for (const cat of node.categories) {
      const peers = this.findPeers(node.nodeId, cat, 3);
      for (const peer of peers) {
        if (!node.connectedPeers.includes(peer.nodeId)) {
          node.connectedPeers.push(peer.nodeId);
          if (!peer.connectedPeers.includes(node.nodeId)) {
            peer.connectedPeers.push(node.nodeId);
          }
        }
      }
    }
  }

  stats() {
    const result: Record<string, number> = {};
    for (const [cat, nodes] of this.subnets) {
      result[cat] = nodes.size;
    }
    return {
      totalNodes: this.nodes.size,
      subnetSizes: result,
    };
  }
}
