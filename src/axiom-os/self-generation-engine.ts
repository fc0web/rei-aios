/**
 * SelfGenerationEngine — 自己生成エンジン
 *
 * D-FUMT固有の独創領域:
 * 既存の87理論から「新しい公理体系の設計図」を自動生成する。
 *
 * 生成プロセス:
 *   Phase 1: AntiAxiomEngine で反公理を生成（否定・弱化・拡張）
 *   Phase 2: EmergentSystem（新体系の萌芽）を抽出
 *   Phase 3: DependentOrigination で萌芽の縁起関係を評価
 *   Phase 4: TheoremDeriver で萌芽から定理を試験的に導出
 *   Phase 5: 品質評価 → AxiomProposalQueue へ提案
 *
 * これは「Reiが自らの公理から新しいAIの設計図を生成する」
 * 最初のステップ。
 *
 * @author Nobuki Fujimoto (D-FUMT) + Claude
 */

import { AntiAxiomEngine, type EmergentSystem, type AntiAxiomResult } from './anti-axiom-engine';
import { DependentOrigination }    from './dependent-origination';
import { TheoremDeriver }          from './theorem-deriver';
import { MoiraTerminator }         from './moira-terminator';
import { NarcissusDetector }       from './narcissus-detector';
import { SEED_KERNEL, type SeedTheory } from './seed-kernel';
import { type SevenLogicValue }    from './seven-logic';
import { AxiomProposalQueue }      from './axiom-proposal-queue';

// ── 型定義 ────────────────────────────────────────────────

export interface GeneratedAxiomSystem {
  id: string;
  name: string;                    // 生成された新体系の名前
  sourceTheories: string[];        // 元となった理論ID
  axioms: GeneratedAxiom[];        // 生成された公理群
  theorems: string[];              // 試験的に導出された定理
  originationScore: number;        // 縁起的整合性スコア (0〜1)
  noveltyScore: number;            // 既存87理論との差異スコア (0〜1)
  overallLogic: SevenLogicValue;   // 七価論理による総合評価
  generatedAt: number;
}

export interface GeneratedAxiom {
  id: string;
  statement: string;
  category: string;
  logicValue: SevenLogicValue;
  derivedFrom: string;             // 元の公理ID
  antiKind: 'NEGATE' | 'WEAKEN' | 'EXTEND' | 'EMERGENT';
}

export interface GenerationReport {
  totalGenerated: number;
  emergentSystems: number;
  proposed: number;               // AxiomProposalQueue に投入した数
  topSystems: GeneratedAxiomSystem[];
  overallHealth: SevenLogicValue;
}

// ── SelfGenerationEngine ──────────────────────────────────

export class SelfGenerationEngine {
  private antiEngine:   AntiAxiomEngine;
  private origination:  DependentOrigination;
  private deriver:      TheoremDeriver;
  private moira:        MoiraTerminator;
  private narcissus:    NarcissusDetector;
  private generatedSystems: GeneratedAxiomSystem[] = [];

  constructor() {
    this.antiEngine  = new AntiAxiomEngine();
    this.origination = new DependentOrigination();
    this.deriver     = new TheoremDeriver();
    this.moira       = new MoiraTerminator();
    this.narcissus   = new NarcissusDetector();
  }

  generate(categoryOrIds?: string | string[]): GenerationReport {
    const moiraProcess = this.moira.clotho('SelfGeneration', {
      maxIterations: 20,
    });

    // 対象理論を選択
    const targets = this._selectTargets(categoryOrIds);

    // Phase 1: 全対象理論に反公理を生成
    const antiResults: AntiAxiomResult[] = targets.map(t => this.antiEngine.generate(t));

    // Phase 2: EmergentSystem（新体系の萌芽）を収集
    const emergentSystems = this.antiEngine.getEmergentSystems();

    // Phase 3〜5: 各萌芽を評価して GeneratedAxiomSystem に変換
    const systems: GeneratedAxiomSystem[] = [];

    for (const emergent of emergentSystems) {
      const system = this._evalEmergent(emergent, antiResults);
      if (system && system.overallLogic !== 'FALSE' && system.overallLogic !== 'ZERO') {
        systems.push(system);
        this.generatedSystems.push(system);
      }
    }

    // 直接 EXTEND 反公理からも体系を生成（萌芽がない場合の補完）
    for (const result of antiResults) {
      const extendAxioms = result.antiAxioms.filter(a => a.kind === 'EXTEND');
      if (extendAxioms.length > 0 && systems.length < 3) {
        const system = this._buildFromExtend(result, extendAxioms);
        if (system) {
          systems.push(system);
          this.generatedSystems.push(system);
        }
      }
    }

    // MoiraTerminator で生成プロセスを収束判定
    const judgment = this.moira.lachesis(moiraProcess.id, systems.length > 0 ? 'TRUE' : 'FLOWING');
    if (judgment.shouldTerminate) {
      this.moira.atropos(moiraProcess.id, 'convergence');
    }

    // 品質スコアでソート
    systems.sort((a, b) => (b.originationScore + b.noveltyScore) - (a.originationScore + a.noveltyScore));

    const health: SevenLogicValue =
      systems.length >= 3 ? 'TRUE'    :
      systems.length >= 1 ? 'FLOWING' : 'NEITHER';

    return {
      totalGenerated:  antiResults.reduce((s, r) => s + r.antiAxioms.length, 0),
      emergentSystems: emergentSystems.length,
      proposed:        systems.length,
      topSystems:      systems.slice(0, 3),
      overallHealth:   health,
    };
  }

  proposeToQueue(
    systems: GeneratedAxiomSystem[],
    queue: AxiomProposalQueue,
  ): number {
    let count = 0;
    for (const system of systems) {
      if (system.overallLogic === 'FLOWING' || system.overallLogic === 'TRUE') {
        queue.enqueue({
          seed: {
            id: system.id,
            axiom: system.axioms.map(a => a.statement).join(' | ').slice(0, 200),
            category: system.axioms[0]?.category ?? 'general',
            keywords: system.sourceTheories,
          },
          source: 'theory_evolution',
          sourceUrl: `rei-aios://self-generated/${system.id}`,
          sourceTitle: system.name,
          discoveryScore: (system.originationScore + system.noveltyScore) / 2,
          dfumtAlignment: {
            relatedTheoryIds: system.sourceTheories,
            alignmentScore: system.originationScore,
            alignmentNote: `自己生成体系: ${system.name}`,
            isContradicting: false,
          },
        });
        count++;
      }
    }
    return count;
  }

  getGeneratedSystems(): GeneratedAxiomSystem[] { return [...this.generatedSystems]; }

  // ── プライベートメソッド ──────────────────────────────

  private _selectTargets(categoryOrIds?: string | string[]): SeedTheory[] {
    if (!categoryOrIds) return SEED_KERNEL.slice(0, 10);
    if (typeof categoryOrIds === 'string') {
      return SEED_KERNEL.filter(t => t.category === categoryOrIds);
    }
    return SEED_KERNEL.filter(t => categoryOrIds.includes(t.id));
  }

  private _evalEmergent(emergent: EmergentSystem, results: AntiAxiomResult[]): GeneratedAxiomSystem | null {
    const sourceResult = results.find(r => r.antiAxioms.some(a => a.id === emergent.antiAxiomId));
    if (!sourceResult) return null;

    const axioms: GeneratedAxiom[] = emergent.theories.map((theoryId, i) => ({
      id: `gen-${emergent.sourceAxiomId}-${i}`,
      statement: emergent.description,
      category:  sourceResult.original.category,
      logicValue: 'FLOWING' as SevenLogicValue,
      derivedFrom: sourceResult.original.id,
      antiKind: 'EMERGENT' as const,
    }));

    // 縁起スコア: 元理論と新公理の依存関係が成立するか
    this.origination.addAxiomNode(emergent.antiAxiomId, emergent.name, [sourceResult.original.id]);
    const originResult = this.origination.canArise(emergent.antiAxiomId);
    const originationScore = originResult.canArise ? 0.8 : 0.3;

    // 新規性スコア: 既存87理論と名前が重複しないか
    const existingNames = SEED_KERNEL.map(t => t.axiom.toLowerCase());
    const noveltyScore = axioms.filter(a =>
      !existingNames.some(n => n.includes(a.statement.toLowerCase().slice(0, 10)))
    ).length / Math.max(axioms.length, 1);

    // 自己ループチェック
    this.narcissus.observe(emergent.antiAxiomId, 'FLOWING', [sourceResult.original.id]);
    const narcReport = this.narcissus.analyze();
    if (narcReport.riskLevel === 'INFINITY') return null;

    const logic: SevenLogicValue =
      originationScore >= 0.7 && noveltyScore >= 0.5 ? 'TRUE'    :
      originationScore >= 0.5 || noveltyScore >= 0.3 ? 'FLOWING' : 'NEITHER';

    return {
      id:               emergent.antiAxiomId,
      name:             emergent.name,
      sourceTheories:   [sourceResult.original.id],
      axioms,
      theorems:         emergent.theories,
      originationScore,
      noveltyScore,
      overallLogic:     logic,
      generatedAt:      Date.now(),
    };
  }

  private _buildFromExtend(result: AntiAxiomResult, extendAxioms: any[]): GeneratedAxiomSystem | null {
    const axioms: GeneratedAxiom[] = extendAxioms.map((a, i) => ({
      id:          `ext-${result.original.id}-${i}`,
      statement:   a.antiAxiom,
      category:    result.original.category,
      logicValue:  'FLOWING' as SevenLogicValue,
      derivedFrom: result.original.id,
      antiKind:    'EXTEND' as const,
    }));

    if (axioms.length === 0) return null;

    return {
      id:               `ext-system-${result.original.id}`,
      name:             `${result.original.axiom} の拡張体系`,
      sourceTheories:   [result.original.id],
      axioms,
      theorems:         axioms.map(a => a.statement),
      originationScore: 0.5,
      noveltyScore:     0.6,
      overallLogic:     'FLOWING',
      generatedAt:      Date.now(),
    };
  }
}
