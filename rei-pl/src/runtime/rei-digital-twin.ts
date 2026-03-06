/**
 * ReiDigitalTwin — space/layer 構文のデジタルツイン意味論
 *
 * 現状の space/layer は「次元数を数える」だけのダミー実装。
 * このモジュールは space/layer に以下のセマンティクスを付与する：
 *
 * space = 現実世界の観測可能な状態空間（デジタルツイン実体）
 * layer = 状態変換パイプライン（変換の層）
 *
 * 縁起論（dependent origination）との対応:
 *   物理実体  = 自己同一的な存在（従来モデル）
 *   デジタルツイン = 関係性の連続スナップショット（縁起論的モデル）
 *
 * @author Nobuki Fujimoto (D-FUMT) + Claude
 */

// ── 七価論理型を自己定義（rei-plはrei-aiosに依存しない） ──

export const SEVEN_VALUES = ['TRUE', 'FALSE', 'BOTH', 'NEITHER', 'INFINITY', 'ZERO', 'FLOWING'] as const;
export type SevenLogicValue = typeof SEVEN_VALUES[number];

const SYMBOL_MAP: Record<SevenLogicValue, string> = {
  TRUE: '\u22a4', FALSE: '\u22a5', BOTH: 'B', NEITHER: 'N',
  INFINITY: '\u221e', ZERO: '\u3007', FLOWING: '\uff5e',
};

export function toSymbol(v: SevenLogicValue): string {
  return SYMBOL_MAP[v] ?? v;
}

// ══════════════════════════════════════════════════════════════
// 型定義
// ══════════════════════════════════════════════════════════════

/** 一つの次元（センサーチャンネル）の値と状態 */
export interface DimensionState {
  name: string;
  value: number | null;
  unit?: string;
  minNormal?: number;
  maxNormal?: number;
  logicTag: SevenLogicValue;
  updatedAt: number;
}

/** space のスナップショット（デジタルツインの一時刻） */
export interface SpaceSnapshot {
  spaceName: string;
  timestamp: number;
  dimensions: DimensionState[];
  overallTag: SevenLogicValue;
  phi: number;
}

/** layer の一段（変換ステージ） */
export type StageTransform = (input: SpaceSnapshot) => SpaceSnapshot | Promise<SpaceSnapshot>;

export interface PipelineStage {
  name: string;
  transform: StageTransform;
  status: SevenLogicValue;
  lastDurationMs: number;
}

/** layer パイプラインの実行結果 */
export interface LayerExecution {
  layerName: string;
  input: SpaceSnapshot;
  output: SpaceSnapshot;
  stages: Array<{
    name: string;
    inputTag: SevenLogicValue;
    outputTag: SevenLogicValue;
    durationMs: number;
  }>;
  totalDurationMs: number;
  overallStatus: SevenLogicValue;
}

// ══════════════════════════════════════════════════════════════
// 次元値 → SevenLogicValue マッピング
// ══════════════════════════════════════════════════════════════

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function valueToLogic(
  value: number | null,
  minNormal?: number,
  maxNormal?: number,
  prevValue?: number | null,
): SevenLogicValue {
  if (value === null) return 'ZERO';
  if (minNormal === undefined || maxNormal === undefined) return 'NEITHER';

  const range = maxNormal - minNormal;
  const loBorder = minNormal + range * 0.05;
  const hiBorder = maxNormal - range * 0.05;
  const loCritical = minNormal - range * 0.5;
  const hiCritical = maxNormal + range * 0.5;

  if (prevValue !== null && prevValue !== undefined) {
    const change = Math.abs(value - prevValue) / range;
    if (change > 0.1 && value >= minNormal && value <= maxNormal) return 'FLOWING';
  }

  if (value < loCritical || value > hiCritical) return 'INFINITY';
  if (value < minNormal || value > maxNormal) return 'FALSE';
  if (value < loBorder || value > hiBorder) return 'FLOWING';
  return 'TRUE';
}

/** 複数次元の論理値から空間全体の論理値を合成 */
export function mergeSpaceLogic(tags: SevenLogicValue[]): SevenLogicValue {
  if (tags.includes('INFINITY')) return 'INFINITY';
  if (tags.every(t => t === 'ZERO')) return 'ZERO';
  if (tags.filter(t => t === 'FALSE').length > tags.length / 2) return 'FALSE';
  if (tags.includes('BOTH')) return 'BOTH';
  if (tags.filter(t => t === 'FLOWING').length > 0) return 'FLOWING';
  if (tags.includes('NEITHER')) return 'NEITHER';
  return 'TRUE';
}

// ══════════════════════════════════════════════════════════════
// ReiSpace クラス
// ══════════════════════════════════════════════════════════════

/**
 * Rei の `space` 構文に対応するランタイム実装
 *
 * Rei 構文: space room_env { temperature, humidity, co2 }
 */
export class ReiSpace {
  private history: SpaceSnapshot[] = [];
  private dimensions: DimensionState[];

  constructor(
    public readonly name: string,
    dimDefs: Array<{
      name: string;
      unit?: string;
      minNormal?: number;
      maxNormal?: number;
    }>,
  ) {
    this.dimensions = dimDefs.map(d => ({
      name: d.name,
      value: null,
      unit: d.unit,
      minNormal: d.minNormal,
      maxNormal: d.maxNormal,
      logicTag: 'ZERO' as SevenLogicValue,
      updatedAt: Date.now(),
    }));
  }

  /** センサー値を更新する（observe = 観測） */
  observe(values: Record<string, number | null>): void {
    for (const dim of this.dimensions) {
      if (dim.name in values) {
        const prev = dim.value;
        dim.value = values[dim.name];
        dim.logicTag = valueToLogic(dim.value, dim.minNormal, dim.maxNormal, prev);
        dim.updatedAt = Date.now();
      }
    }
  }

  /** 現在の状態スナップショットを取得（デジタルツインの一時刻） */
  snap(): SpaceSnapshot {
    const dims = this.dimensions.map(d => ({ ...d }));
    const tags = dims.map(d => d.logicTag);
    const overallTag = mergeSpaceLogic(tags);

    const trueCount = tags.filter(t => t === 'TRUE' || t === 'FLOWING').length;
    const phi = dims.length > 0 ? trueCount / dims.length : 0;

    const snapshot: SpaceSnapshot = {
      spaceName: this.name,
      timestamp: Date.now(),
      dimensions: dims,
      overallTag,
      phi,
    };

    this.history.push(snapshot);
    if (this.history.length > 100) this.history.shift();

    return snapshot;
  }

  /** 前回スナップショットとの差分を七価論理で返す */
  diff(): SevenLogicValue {
    if (this.history.length < 2) return 'ZERO';
    const prev = this.history[this.history.length - 2];
    const curr = this.history[this.history.length - 1];
    if (!prev || !curr) return 'ZERO';

    const phiDelta = Math.abs(curr.phi - prev.phi);
    if (phiDelta < 0.02) return 'TRUE';
    if (phiDelta < 0.1)  return 'FLOWING';
    if (curr.overallTag === 'INFINITY') return 'INFINITY';
    return 'FLOWING';
  }

  /** デジタルツインとして仮想空間に投影 */
  mirror(): {
    physicalName: string;
    virtualName: string;
    snapshot: SpaceSnapshot;
    mirrorQuality: SevenLogicValue;
    mirrorNote: string;
  } {
    const snapshot = this.snap();
    const nullCount = snapshot.dimensions.filter(d => d.value === null).length;
    const mirrorQuality: SevenLogicValue =
      nullCount === 0 ? 'TRUE' :
      nullCount < snapshot.dimensions.length / 2 ? 'FLOWING' :
      'NEITHER';

    const notes: Record<SevenLogicValue, string> = {
      'TRUE':     '完全な鏡像。全次元が観測済み。',
      'FLOWING':  '部分的な鏡像。一部次元が変化中または欠損。',
      'NEITHER':  '不完全な鏡像。センサー欠損が多い。',
      'ZERO':     '空の鏡。全次元未観測。',
      'FALSE':    '歪んだ鏡。異常値が支配的。',
      'BOTH':     '矛盾する鏡。同時に複数の状態を示す。',
      'INFINITY': '危険な鏡。臨界値を超えた次元が存在。',
    };

    return {
      physicalName: this.name,
      virtualName: `${this.name}::twin`,
      snapshot,
      mirrorQuality,
      mirrorNote: notes[mirrorQuality],
    };
  }

  /** 次元名リスト */
  get dimensionNames(): string[] {
    return this.dimensions.map(d => d.name);
  }
}

// ══════════════════════════════════════════════════════════════
// ReiLayer クラス
// ══════════════════════════════════════════════════════════════

/**
 * Rei の `layer` 構文に対応するランタイム実装
 *
 * Rei 構文: layer control { sense -> plan -> act -> report }
 */
export class ReiLayer {
  private stages: PipelineStage[];

  constructor(
    public readonly name: string,
    stageDefs: Array<{ name: string; transform: StageTransform }>,
  ) {
    this.stages = stageDefs.map(s => ({
      name: s.name,
      transform: s.transform,
      status: 'ZERO' as SevenLogicValue,
      lastDurationMs: 0,
    }));
  }

  /** パイプライン全体を実行する */
  async execute(input: SpaceSnapshot): Promise<LayerExecution> {
    const stageResults: LayerExecution['stages'] = [];
    let current = input;
    const startTotal = Date.now();

    for (const stage of this.stages) {
      const startStage = Date.now();
      const inputTag = current.overallTag;

      try {
        const output = await stage.transform(current);
        const durationMs = Date.now() - startStage;
        stage.status = output.overallTag;
        stage.lastDurationMs = durationMs;

        stageResults.push({
          name: stage.name,
          inputTag,
          outputTag: output.overallTag,
          durationMs,
        });

        current = output;

        if (output.overallTag === 'INFINITY') break;

      } catch (_err) {
        stage.status = 'NEITHER';
        stageResults.push({
          name: stage.name,
          inputTag,
          outputTag: 'NEITHER',
          durationMs: Date.now() - startStage,
        });
        break;
      }
    }

    const totalDurationMs = Date.now() - startTotal;
    const allOutputTags = stageResults.map(s => s.outputTag);
    const overallStatus = mergeSpaceLogic(allOutputTags);

    return {
      layerName: this.name,
      input,
      output: current,
      stages: stageResults,
      totalDurationMs,
      overallStatus,
    };
  }

  /** パイプライン各段の七価状態を返す */
  status(): Record<string, SevenLogicValue> {
    return Object.fromEntries(this.stages.map(s => [s.name, s.status]));
  }

  /** ステージ名リスト */
  get stageNames(): string[] {
    return this.stages.map(s => s.name);
  }
}

// ══════════════════════════════════════════════════════════════
// Rei AST ブリッジ
// ══════════════════════════════════════════════════════════════

export const ReiDigitalTwinFactory = {
  createSpace(node: { name: string; dimensions: string[] }): ReiSpace {
    return new ReiSpace(
      node.name,
      node.dimensions.map(dim => ({ name: dim })),
    );
  },

  createLayer(
    node: { name: string },
    transforms: StageTransform[],
    stageNames: string[],
  ): ReiLayer {
    return new ReiLayer(
      node.name,
      stageNames.map((name, i) => ({ name, transform: transforms[i] })),
    );
  },
};
