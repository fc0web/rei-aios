/**
 * Rei-AIOS テーマI — MathSimulator
 * 藤本伸樹氏のnote記事「チャット数式化インタラクティブシミュレーション」
 * に掲載された4つの数式をリアルタイム計算するエンジン。
 *
 * 数式一覧:
 *   1. 教育価値関数:   V(t) = V₀ × e^(-λt) × (1 + α×I(t))
 *   2. 収益化困難度:   D = (AI能力 × アクセス性) / (独自性 × 人間価値)
 *   3. 情報エントロピー: H(M) = -Σ(pᵢ × log₂(pᵢ))
 *   4. ネットワーク密度: D_nw = 2|E| / (|V|(|V|-1))
 *
 * D-FUMT統合:
 *   各計算結果を DFUMTEngine.run() への入力ベクトルとして渡す。
 *   中心 = 数式計算結果, 周囲 = D-FUMTパイプライン分析
 */

import {
  EducationValueParams, MonetizationParams, NetworkParams,
  SimPoint, SimResult,
  DEFAULT_EDU_PARAMS, DEFAULT_MON_PARAMS, DEFAULT_NET_PARAMS,
} from './types';

const PHI = 1.6180339887;
const PI  = Math.PI;

export class MathSimulator {

  // ──────────────────────────────────────────────────────────
  // 1. 教育価値関数  V(t) = V₀ × e^(-λt) × (1 + α×I(t))
  //    I(t): イノベーション流入率（ロジスティック成長近似）
  // ──────────────────────────────────────────────────────────
  educationValue(t: number, p: EducationValueParams): number {
    const It = p.innovRate / (1 + Math.exp(-0.5 * (t - 10)));   // シグモイド曲線
    return p.V0 * Math.exp(-p.lambda * t) * (1 + p.alpha * It);
  }

  // ──────────────────────────────────────────────────────────
  // 2. 収益化困難度  D = (AI能力 × アクセス性) / (独自性 × 人間価値)
  // ──────────────────────────────────────────────────────────
  monetizationDifficulty(p: MonetizationParams): number {
    const denom = p.uniqueness * p.humanValue;
    if (denom < 1e-10) return 999;
    return (p.aiCapability * p.accessibility) / denom;
  }

  // ──────────────────────────────────────────────────────────
  // 3. 情報エントロピー  H(M) = -Σ(pᵢ × log₂(pᵢ))
  //    確率分布: 均等分布からAI比率αで歪める
  // ──────────────────────────────────────────────────────────
  informationEntropy(alpha: number, n = 8): number {
    // p_i: alpha で偏った分布を構築
    const raw: number[] = [];
    for (let i = 0; i < n; i++) {
      const base = 1 / n;
      const bias = (alpha * PHI) / (i + PHI);
      raw.push(base + bias * (i % 2 === 0 ? 1 : -1) * 0.1);
    }
    const sum = raw.reduce((a, b) => a + Math.abs(b), 0);
    const probs = raw.map(v => Math.abs(v) / sum);
    return -probs.reduce((h, p) => h + (p > 0 ? p * Math.log2(p) : 0), 0);
  }

  // ──────────────────────────────────────────────────────────
  // 4. ネットワーク密度  D_nw = 2|E| / (|V|(|V|-1))
  // ──────────────────────────────────────────────────────────
  networkDensity(p: NetworkParams): number {
    const maxEdges = p.nodes * (p.nodes - 1);
    if (maxEdges === 0) return 0;
    return (2 * p.edges) / maxEdges;
  }

  // ──────────────────────────────────────────────────────────
  // 時系列シミュレーション実行 t = 0 .. 20
  // ──────────────────────────────────────────────────────────
  runTimeline(
    eduParams:  EducationValueParams = DEFAULT_EDU_PARAMS,
    monParams:  MonetizationParams   = DEFAULT_MON_PARAMS,
    netParams:  NetworkParams        = DEFAULT_NET_PARAMS,
    steps = 21,
  ): SimResult {
    const timeline: SimPoint[] = [];
    const difficulty  = this.monetizationDifficulty(monParams);
    const entropy     = this.informationEntropy(eduParams.alpha);
    const netDensity  = this.networkDensity(netParams);

    for (let i = 0; i < steps; i++) {
      const t = i;
      const v = this.educationValue(t, eduParams);
      timeline.push({
        t,
        value:          Math.max(0, v),
        difficulty,
        entropy,
        networkDensity: netDensity,
      });
    }

    const values = timeline.map(p => p.value);
    const peakValue    = Math.max(...values);
    const minValue     = Math.min(...values);

    // D-FUMTエンジン入力ベクトル（現在t=10の値を中心に構成）
    const mid = timeline[Math.floor(steps / 2)];
    const dfumtVector = [
      mid.value / 100,
      difficulty > 0 ? Math.min(1, 1 / difficulty) : 0,
      entropy / Math.log2(8),
      netDensity,
      PHI * (mid.value / 100),
    ];

    return {
      params: { education: eduParams, monetization: monParams, network: netParams },
      timeline,
      currentT: 10,
      summary:  { peakValue, minValue, avgDifficulty: difficulty, entropy, networkDensity: netDensity },
      dfumtVector,
    };
  }

  /** 単一時刻の全値を計算（スライダー操作用） */
  evaluate(
    t: number,
    eduParams:  EducationValueParams,
    monParams:  MonetizationParams,
    netParams:  NetworkParams,
  ): SimPoint {
    return {
      t,
      value:          Math.max(0, this.educationValue(t, eduParams)),
      difficulty:     this.monetizationDifficulty(monParams),
      entropy:        this.informationEntropy(eduParams.alpha),
      networkDensity: this.networkDensity(netParams),
    };
  }

  /** プリセット: AI時代の典型シナリオ */
  presetScenario(name: 'ai-disruption' | 'innovation' | 'balance' | 'human-focus'): {
    edu: EducationValueParams; mon: MonetizationParams; net: NetworkParams; label: string;
  } {
    const presets = {
      'ai-disruption': {
        label: 'AI破壊シナリオ',
        edu: { V0: 100, lambda: 0.6, alpha: 0.2, innovRate: 0.2 },
        mon: { aiCapability: 0.95, accessibility: 0.9, uniqueness: 0.2, humanValue: 0.3 },
        net: { nodes: 80, edges: 400 },
      },
      'innovation': {
        label: 'イノベーション爆発',
        edu: { V0: 80, lambda: 0.1, alpha: 0.9, innovRate: 0.8 },
        mon: { aiCapability: 0.7, accessibility: 0.6, uniqueness: 0.8, humanValue: 0.7 },
        net: { nodes: 100, edges: 600 },
      },
      'balance': {
        label: 'ハイブリッド均衡',
        edu: { V0: 100, lambda: 0.3, alpha: 0.5, innovRate: 0.4 },
        mon: { aiCapability: 0.6, accessibility: 0.7, uniqueness: 0.5, humanValue: 0.6 },
        net: { nodes: 50, edges: 150 },
      },
      'human-focus': {
        label: '人間価値重視',
        edu: { V0: 90, lambda: 0.15, alpha: 0.6, innovRate: 0.5 },
        mon: { aiCapability: 0.4, accessibility: 0.5, uniqueness: 0.9, humanValue: 0.95 },
        net: { nodes: 40, edges: 80 },
      },
    };
    return presets[name];
  }
}

export const mathSimulator = new MathSimulator();
