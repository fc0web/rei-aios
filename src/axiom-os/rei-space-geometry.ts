/**
 * ReiSpaceGeometry — ポリゴン分解 × space構文の幾何学計算
 *
 * D-FUMT Theory #70: アステカ空間分解理論
 * 「複雑空間は単純凸多角形の和集合として表現できる」
 *
 * アステカ対応:
 *   土地 -> ReiSpace（多次元空間）
 *   測量分割 -> SpacePartition（空間分割）
 *   面積計算 -> coverageScore（カバレッジスコア）
 *
 * 応用:
 *   センサー空間の「正常域」を多角形で定義
 *   観測値がどの領域に属するかを七価論理で評価
 */

import { type SevenLogicValue } from './seven-logic';

// 2次元点（任意次元に拡張可能）
export interface Point {
  x: number;
  y: number;
}

// 凸多角形（単純図形）
export interface ConvexPolygon {
  id: string;
  vertices: Point[];
  label: SevenLogicValue;  // この領域の七価論理的意味
}

// 空間分割結果
export interface SpacePartition {
  polygons: ConvexPolygon[];
  totalArea: number;
  coverageMap: Map<string, number>;  // polygon.id -> 面積
}

// 分割評価結果
export interface GeometryEvalResult {
  point: Point;
  containingPolygon?: ConvexPolygon;
  logicTag: SevenLogicValue;
  distanceToNearest: number;
  interpretation: string;
}

export class ReiSpaceGeometry {

  /**
   * ガウス公式（Shoelace）で多角形の面積を計算
   * アステカの土地測量と同じ原理
   */
  calcArea(vertices: Point[]): number {
    const n = vertices.length;
    if (n < 3) return 0;
    let area = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += vertices[i].x * vertices[j].y;
      area -= vertices[j].x * vertices[i].y;
    }
    return Math.abs(area) / 2;
  }

  /**
   * 点が凸多角形の内部にあるか判定
   * （射影法: 各辺の左側にあるか）
   */
  containsPoint(polygon: ConvexPolygon, p: Point): boolean {
    const verts = polygon.vertices;
    const n = verts.length;
    for (let i = 0; i < n; i++) {
      const a = verts[i];
      const b = verts[(i + 1) % n];
      // 外積で左側判定
      const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
      if (cross < 0) return false;
    }
    return true;
  }

  /**
   * 点に最も近い多角形への距離を計算
   */
  distanceToPolygon(polygon: ConvexPolygon, p: Point): number {
    let minDist = Infinity;
    const verts = polygon.vertices;
    for (const v of verts) {
      const d = Math.hypot(p.x - v.x, p.y - v.y);
      if (d < minDist) minDist = d;
    }
    return minDist;
  }

  /**
   * 空間を多角形群で分割し、各多角形の面積を計算する
   * （アステカの土地分割測量）
   */
  partition(polygons: ConvexPolygon[]): SpacePartition {
    const coverageMap = new Map<string, number>();
    let totalArea = 0;
    for (const poly of polygons) {
      const area = this.calcArea(poly.vertices);
      coverageMap.set(poly.id, area);
      totalArea += area;
    }
    return { polygons, totalArea, coverageMap };
  }

  /**
   * 観測点を評価し、七価論理タグを返す
   *
   * 使用例: センサー値 (cpu%, mem%) を2D点として評価
   *   正常域ポリゴン(TRUE) の内部 -> TRUE
   *   警告域ポリゴン(FLOWING) の内部 -> FLOWING
   *   危険域ポリゴン(INFINITY) の内部 -> INFINITY
   *   どこにも属さない -> NEITHER
   */
  evaluate(partition: SpacePartition, point: Point): GeometryEvalResult {
    // 内部にある多角形を探す
    for (const poly of partition.polygons) {
      if (this.containsPoint(poly, point)) {
        return {
          point,
          containingPolygon: poly,
          logicTag: poly.label,
          distanceToNearest: 0,
          interpretation: `領域「${poly.id}」(${poly.label}) の内部`,
        };
      }
    }

    // どこにも属さない: 最近傍距離を計算
    let nearest = partition.polygons[0];
    let minDist = Infinity;
    for (const poly of partition.polygons) {
      const d = this.distanceToPolygon(poly, point);
      if (d < minDist) { minDist = d; nearest = poly; }
    }

    return {
      point,
      containingPolygon: undefined,
      logicTag: 'NEITHER',
      distanceToNearest: minDist,
      interpretation: `定義領域外（最近傍: 「${nearest?.id}」まで ${minDist.toFixed(2)}）`,
    };
  }

  /**
   * PCSensorBridge と統合: CPU/メモリの2D空間を評価
   */
  evaluatePCState(cpuPercent: number, memPercent: number): GeometryEvalResult {
    // PC状態空間を3つの領域に分割（アステカの土地分割）
    const normalZone: ConvexPolygon = {
      id: 'normal', label: 'TRUE',
      vertices: [{ x: 0, y: 0 }, { x: 70, y: 0 }, { x: 70, y: 80 }, { x: 0, y: 80 }],
    };
    const warningZone: ConvexPolygon = {
      id: 'warning', label: 'FLOWING',
      vertices: [{ x: 70, y: 0 }, { x: 90, y: 0 }, { x: 90, y: 95 }, { x: 70, y: 95 }, { x: 70, y: 80 }],
    };
    const dangerZone: ConvexPolygon = {
      id: 'danger', label: 'INFINITY',
      vertices: [{ x: 90, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }, { x: 0, y: 95 }, { x: 90, y: 95 }],
    };

    const part = this.partition([normalZone, warningZone, dangerZone]);
    return this.evaluate(part, { x: cpuPercent, y: memPercent });
  }
}
