import { CodeAxiomExtractor, type ExtractionResult, type CodePattern } from './code-axiom-extractor';
import { ConsensusEngine, type InstanceVote } from './consensus-engine';
import { type SeedTheory } from './seed-kernel';
import { type SevenLogicValue } from './seven-logic';

// ノード（参加者）の定義
export interface AxiomNode {
  id: string;           // ノードID（例: "node-01", "fc0web-main"）
  name: string;         // 表示名
  weight: number;       // 信頼重み (0.0〜1.0)
  sources: { name: string; code: string }[]; // 担当コード
}

// パイプライン実行結果
export interface PipelineResult {
  nodes: number;                    // 参加ノード数
  totalLines: number;               // 処理総行数
  consensusAxioms: SeedTheory[];    // 合意された公理
  pendingAxioms: SeedTheory[];      // FLOWING保留（合意未達）
  rejectedAxioms: SeedTheory[];     // 否定された公理
  compressionEstimate: number;      // 推定圧縮率
  sevenLogicSummary: string;        // 七価論理サマリー
  rounds: number;                   // 合意ラウンド数
}

// 七価論理スコア→SevenLogicValue変換
function confidenceToLogic(confidence: number): SevenLogicValue {
  if (confidence >= 0.9) return 'TRUE';
  if (confidence >= 0.7) return 'FLOWING';
  if (confidence >= 0.5) return 'ZERO';
  return 'FALSE';
}

export class DistributedAxiomPipeline {
  private extractor = new CodeAxiomExtractor();
  private consensus = new ConsensusEngine();

  // メイン実行: ノード群から分散抽出→合意形成
  run(nodes: AxiomNode[], rounds = 2): PipelineResult {
    // Step1: 各ノードで公理抽出
    const nodeResults: ExtractionResult[] = nodes.map(node => {
      const batch = this.extractor.extractBatch(node.sources);
      return this.extractor.mergeResults(batch);
    });

    // Step2: パターンIDをキーに全ノードの票を集約
    const patternVoteMap = new Map<string, { pattern: CodePattern; votes: InstanceVote[] }>();

    nodes.forEach((node, i) => {
      const result = nodeResults[i];
      for (const pattern of result.patterns) {
        const key = `${pattern.kind}:${pattern.source}`;
        if (!patternVoteMap.has(key)) {
          patternVoteMap.set(key, { pattern, votes: [] });
        }
        patternVoteMap.get(key)!.votes.push({
          instanceId: node.id,
          value: confidenceToLogic(pattern.confidence),
          reasoning: `${node.name}: ${pattern.axiom}`,
          axiomRefs: [pattern.id],
          confidence: pattern.confidence * node.weight,
          timestamp: Date.now(),
        });
      }
    });

    // Step3: ConsensusEngineで各パターンの合意を形成
    const consensusAxioms: SeedTheory[] = [];
    const pendingAxioms: SeedTheory[]   = [];
    const rejectedAxioms: SeedTheory[]  = [];

    for (const [key, { pattern, votes }] of patternVoteMap) {
      const result = this.consensus.reach(key, votes, rounds);
      const seed: SeedTheory = {
        id: pattern.id,
        axiom: pattern.axiom,
        keywords: pattern.keywords,
        category: pattern.category,
      };

      if (result.finalValue === 'TRUE' || result.finalValue === 'FLOWING') {
        if (result.finalConfidence >= 0.7) {
          consensusAxioms.push(seed);
        } else {
          pendingAxioms.push(seed);
        }
      } else {
        rejectedAxioms.push(seed);
      }
    }

    // Step4: 圧縮率推定
    const totalLines = nodeResults.reduce((s, r) => s + r.totalLines, 0);
    const compressionEstimate = totalLines > 0
      ? Math.max(0.01, consensusAxioms.length / totalLines)
      : 1.0;

    // Step5: 七価論理サマリー
    const totalPatterns = patternVoteMap.size;
    const consensusRatio = consensusAxioms.length / Math.max(totalPatterns, 1);
    let sevenLogicSummary: string;
    if (consensusRatio >= 0.8)      sevenLogicSummary = '⊤ 高合意（TRUE）';
    else if (consensusRatio >= 0.6) sevenLogicSummary = '～ 流動的合意（FLOWING）';
    else if (consensusRatio >= 0.4) sevenLogicSummary = '〇 部分合意（ZERO）';
    else if (pendingAxioms.length > rejectedAxioms.length)
                                    sevenLogicSummary = 'B 矛盾保留（BOTH）';
    else                            sevenLogicSummary = '⊥ 合意不成立（FALSE）';

    return {
      nodes: nodes.length,
      totalLines,
      consensusAxioms,
      pendingAxioms,
      rejectedAxioms,
      compressionEstimate,
      sevenLogicSummary,
      rounds,
    };
  }

  // 単一コードからの簡易パイプライン（シングルノード）
  runSingle(code: string, nodeId = 'local', language = 'typescript'): PipelineResult {
    const result = this.extractor.extract(code, language);
    const consensusAxioms = result.seedTheories.filter(
      (_, i) => result.patterns[i].confidence >= 0.7
    );
    const pendingAxioms = result.seedTheories.filter(
      (_, i) => result.patterns[i].confidence >= 0.5 && result.patterns[i].confidence < 0.7
    );
    const rejectedAxioms = result.seedTheories.filter(
      (_, i) => result.patterns[i].confidence < 0.5
    );

    return {
      nodes: 1,
      totalLines: result.totalLines,
      consensusAxioms,
      pendingAxioms,
      rejectedAxioms,
      compressionEstimate: result.compressionHint,
      sevenLogicSummary: result.sevenLogicTag,
      rounds: 1,
    };
  }

  // 報告レポート生成
  report(result: PipelineResult): string {
    const lines: string[] = [
      '=== 分散公理抽出パイプライン 結果レポート ===',
      `参加ノード数  : ${result.nodes}`,
      `処理総行数    : ${result.totalLines}`,
      `合意公理数    : ${result.consensusAxioms.length}`,
      `保留公理数    : ${result.pendingAxioms.length}`,
      `否定公理数    : ${result.rejectedAxioms.length}`,
      `推定圧縮率    : ${(result.compressionEstimate * 100).toFixed(2)}%`,
      `七価論理状態  : ${result.sevenLogicSummary}`,
      '',
      '--- 合意された公理 (上位5件) ---',
      ...result.consensusAxioms.slice(0, 5).map(
        s => `  [${s.category}] ${s.axiom}`
      ),
    ];
    return lines.join('\n');
  }
}
