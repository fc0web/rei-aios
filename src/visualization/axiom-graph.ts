/**
 * Rei-AIOS STEP 13-B — AxiomGraph
 * 公理の依存グラフ可視化エンジン
 *
 * Canvas APIでフロー図を描画。
 * D-FUMT値で色分け・ノードクリックで詳細表示。
 * 外部ライブラリ不要（純粋なCanvas 2D）。
 */

import type { DFUMTValue } from '../memory/aios-memory';

export interface AxiomNode {
  id: string;           // "Theory #1" など
  label: string;        // 短い表示名
  description: string;  // 説明
  dfumtValue: DFUMTValue;
  category: string;
  x?: number;           // Canvas上のX座標（自動計算）
  y?: number;           // Canvas上のY座標（自動計算）
}

export interface AxiomEdge {
  from: string;         // ノードID
  to: string;           // ノードID
  type: 'depends' | 'derives' | 'contradicts' | 'extends';
  label?: string;
}

export interface AxiomGraph {
  nodes: AxiomNode[];
  edges: AxiomEdge[];
}

// ─── D-FUMT値の色・形定義 ────────────────────────────────────
export const DFUMT_GRAPH_STYLE: Record<DFUMTValue, {
  color: string; border: string; shape: string;
}> = {
  TRUE:     { color: '#1a2a4a', border: '#88aaff', shape: 'rect' },
  FALSE:    { color: '#2a1a1a', border: '#cc6677', shape: 'rect' },
  BOTH:     { color: '#2a1a4a', border: '#aa88ff', shape: 'diamond' },
  NEITHER:  { color: '#2a2a2a', border: '#888888', shape: 'circle' },
  INFINITY: { color: '#2a1a00', border: '#ffaa44', shape: 'hexagon' },
  ZERO:     { color: '#001a2a', border: '#44aacc', shape: 'circle' },
  FLOWING:  { color: '#0a2a1a', border: '#88ccaa', shape: 'rounded' },
};

// ─── エッジの色定義 ──────────────────────────────────────────
const EDGE_STYLE: Record<string, { color: string; dash: number[] }> = {
  depends:     { color: '#5566aa', dash: [] },
  derives:     { color: '#55aa66', dash: [5, 3] },
  contradicts: { color: '#aa5566', dash: [3, 3] },
  extends:     { color: '#aa9944', dash: [8, 3] },
};

// ─── AxiomGraph メインクラス ─────────────────────────────────
export class AxiomGraphEngine {
  // ── グラフデータ構築 ─────────────────────────────────────
  buildFromSeedKernel(): AxiomGraph {
    const nodes: AxiomNode[] = [
      { id: '#1',  label: '四値論理基礎',  description: 'catuskoti四値論理の基礎', dfumtValue: 'TRUE',  category: 'logic' },
      { id: '#2',  label: '七価論理拡張',  description: 'D-FUMT七価論理への拡張',  dfumtValue: 'BOTH',  category: 'logic' },
      { id: '#3',  label: '空理論',        description: 'sunyataの数学的記述',     dfumtValue: 'NEITHER', category: 'philosophy' },
      { id: '#5',  label: '縁起公理',      description: '依存発生の公理系',        dfumtValue: 'FLOWING', category: 'philosophy' },
      { id: '#10', label: '零π理論',       description: 'ゼロと円周率の関係',      dfumtValue: 'ZERO',  category: 'mathematics' },
      { id: '#23', label: '螺旋数論',      description: '黄金比と螺旋の数学',      dfumtValue: 'INFINITY', category: 'mathematics' },
      { id: '#45', label: 'SAC C1-C6',    description: '意識数学の公理群',        dfumtValue: 'BOTH',  category: 'consciousness' },
      { id: '#67', label: 'RCT圧縮理論',  description: 'Rei圧縮理論（11/15勝）', dfumtValue: 'TRUE',  category: 'compression' },
      { id: '#76', label: 'UMTE U1-U5',   description: '統一数学的真理体系',      dfumtValue: 'FLOWING', category: 'mathematics' },
      { id: '#87', label: '非数値数学',    description: '数値を超えた数学',        dfumtValue: 'NEITHER', category: 'mathematics' },
      { id: '#92', label: 'MMRT/AMRT',    description: '多次元推論理論',          dfumtValue: 'INFINITY', category: 'logic' },
      { id: '#100', label: '公理ネット完全性', description: '公理ネットワーク完全性定理', dfumtValue: 'TRUE', category: 'meta' },
    ];

    const edges: AxiomEdge[] = [
      { from: '#1',  to: '#2',   type: 'extends',  label: '拡張' },
      { from: '#2',  to: '#45',  type: 'derives',  label: '派生' },
      { from: '#2',  to: '#92',  type: 'derives',  label: '派生' },
      { from: '#3',  to: '#5',   type: 'depends',  label: '依存' },
      { from: '#5',  to: '#45',  type: 'depends',  label: '依存' },
      { from: '#10', to: '#23',  type: 'extends',  label: '拡張' },
      { from: '#23', to: '#67',  type: 'derives',  label: '応用' },
      { from: '#45', to: '#76',  type: 'derives',  label: '派生' },
      { from: '#67', to: '#100', type: 'depends',  label: '依存' },
      { from: '#76', to: '#87',  type: 'extends',  label: '拡張' },
      { from: '#87', to: '#92',  type: 'depends',  label: '依存' },
      { from: '#92', to: '#100', type: 'depends',  label: '依存' },
      { from: '#1',  to: '#3',   type: 'contradicts', label: '矛盾?' },
    ];

    return { nodes, edges };
  }

  // ── 階層レイアウト計算 ──────────────────────────────────
  calcLayout(
    graph: AxiomGraph,
    width: number,
    height: number
  ): AxiomGraph {
    const levels: Map<string, number> = new Map();

    const hasIncoming = new Set(graph.edges.map(e => e.to));
    const roots = graph.nodes
      .filter(n => !hasIncoming.has(n.id))
      .map(n => n.id);

    const queue = [...roots];
    roots.forEach(r => levels.set(r, 0));

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentLevel = levels.get(current) ?? 0;
      const children = graph.edges
        .filter(e => e.from === current)
        .map(e => e.to);

      for (const child of children) {
        const existingLevel = levels.get(child) ?? -1;
        if (existingLevel <= currentLevel) {
          levels.set(child, currentLevel + 1);
          queue.push(child);
        }
      }
    }

    const levelNodes: Map<number, string[]> = new Map();
    for (const [nodeId, level] of levels) {
      if (!levelNodes.has(level)) levelNodes.set(level, []);
      levelNodes.get(level)!.push(nodeId);
    }

    const maxLevel = Math.max(...levels.values(), 0);
    const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));

    const padding = 60;
    const levelHeight = (height - padding * 2) / (maxLevel + 1);

    for (const [level, nodeIds] of levelNodes) {
      const nodeWidth = (width - padding * 2) / (nodeIds.length + 1);
      nodeIds.forEach((nodeId, i) => {
        const node = nodeMap.get(nodeId);
        if (node) {
          node.x = padding + nodeWidth * (i + 1);
          node.y = padding + levelHeight * level + levelHeight / 2;
        }
      });
    }

    let unplacedX = padding;
    for (const node of graph.nodes) {
      if (node.x === undefined) {
        node.x = unplacedX;
        node.y = height - padding;
        unplacedX += 120;
      }
    }

    return graph;
  }

  // ── Canvas描画コード生成 ──────────────────────────────────
  generateCanvasScript(): string {
    return `
// ─── STEP 13-B: 公理依存グラフ ──────────────────────────────
let axiomGraphData = null;
let selectedAxiomNode = null;
let graphScale = 1.0;
let graphOffsetX = 0;
let graphOffsetY = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

const DFUMT_GRAPH_STYLE = ${JSON.stringify(DFUMT_GRAPH_STYLE)};
const EDGE_STYLE = ${JSON.stringify(EDGE_STYLE)};

function initAxiomGraph() {
  const canvas = document.getElementById('axiom-graph-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth || 800;
  canvas.height = canvas.offsetHeight || 500;

  // グラフデータ初期化
  axiomGraphData = buildAxiomGraphData(canvas.width, canvas.height);
  drawAxiomGraph(ctx, axiomGraphData, canvas.width, canvas.height);

  // マウスイベント
  canvas.addEventListener('click', (e) => onGraphClick(e, canvas, ctx));
  canvas.addEventListener('wheel', (e) => onGraphWheel(e, canvas, ctx));
  canvas.addEventListener('mousedown', (e) => { isDragging = true; dragStartX = e.offsetX; dragStartY = e.offsetY; });
  canvas.addEventListener('mousemove', (e) => {
    if (isDragging) {
      graphOffsetX += e.offsetX - dragStartX;
      graphOffsetY += e.offsetY - dragStartY;
      dragStartX = e.offsetX;
      dragStartY = e.offsetY;
      drawAxiomGraph(ctx, axiomGraphData, canvas.width, canvas.height);
    }
    onGraphHover(e, canvas);
  });
  canvas.addEventListener('mouseup', () => { isDragging = false; });
}

function buildAxiomGraphData(width, height) {
  const nodes = [
    { id: '#1',  label: '四値論理基礎',      description: 'catuskoti四値論理の基礎', dfumtValue: 'TRUE',     category: 'logic' },
    { id: '#2',  label: '七価論理拡張',      description: 'D-FUMT七価論理への拡張',  dfumtValue: 'BOTH',     category: 'logic' },
    { id: '#3',  label: '空理論',            description: 'sunyataの数学的記述',     dfumtValue: 'NEITHER',  category: 'philosophy' },
    { id: '#5',  label: '縁起公理',          description: '依存発生の公理系',        dfumtValue: 'FLOWING',  category: 'philosophy' },
    { id: '#10', label: '零π理論',           description: 'ゼロと円周率の関係',      dfumtValue: 'ZERO',     category: 'mathematics' },
    { id: '#23', label: '螺旋数論',          description: '黄金比と螺旋の数学',      dfumtValue: 'INFINITY', category: 'mathematics' },
    { id: '#45', label: 'SAC意識公理',       description: '意識数学の公理群C1-C6',   dfumtValue: 'BOTH',     category: 'consciousness' },
    { id: '#67', label: 'RCT圧縮理論',      description: 'Rei圧縮理論（11/15勝）', dfumtValue: 'TRUE',     category: 'compression' },
    { id: '#76', label: 'UMTE統一理論',     description: '統一数学的真理体系U1-U5', dfumtValue: 'FLOWING',  category: 'mathematics' },
    { id: '#87', label: '非数値数学',        description: '数値を超えた数学',        dfumtValue: 'NEITHER',  category: 'mathematics' },
    { id: '#92', label: 'MMRT多次元推論',   description: '多次元推論理論',          dfumtValue: 'INFINITY', category: 'logic' },
    { id: '#100', label: '公理ネット完全性', description: '公理ネットワーク完全性定理', dfumtValue: 'TRUE',  category: 'meta' },
  ];

  const edges = [
    { from: '#1',  to: '#2',   type: 'extends',     label: '拡張' },
    { from: '#2',  to: '#45',  type: 'derives',     label: '派生' },
    { from: '#2',  to: '#92',  type: 'derives',     label: '派生' },
    { from: '#3',  to: '#5',   type: 'depends',     label: '依存' },
    { from: '#5',  to: '#45',  type: 'depends',     label: '依存' },
    { from: '#10', to: '#23',  type: 'extends',     label: '拡張' },
    { from: '#23', to: '#67',  type: 'derives',     label: '応用' },
    { from: '#45', to: '#76',  type: 'derives',     label: '派生' },
    { from: '#67', to: '#100', type: 'depends',     label: '依存' },
    { from: '#76', to: '#87',  type: 'extends',     label: '拡張' },
    { from: '#87', to: '#92',  type: 'depends',     label: '依存' },
    { from: '#92', to: '#100', type: 'depends',     label: '依存' },
    { from: '#1',  to: '#3',   type: 'contradicts', label: '矛盾?' },
  ];

  // 階層レイアウト計算
  const levels = new Map();
  const hasIncoming = new Set(edges.map(e => e.to));
  const roots = nodes.filter(n => !hasIncoming.has(n.id)).map(n => n.id);
  roots.forEach(r => levels.set(r, 0));

  const queue = [...roots];
  while (queue.length > 0) {
    const current = queue.shift();
    const currentLevel = levels.get(current) || 0;
    edges.filter(e => e.from === current).forEach(e => {
      if ((levels.get(e.to) || 0) <= currentLevel) {
        levels.set(e.to, currentLevel + 1);
        queue.push(e.to);
      }
    });
  }

  const levelNodes = new Map();
  levels.forEach((level, nodeId) => {
    if (!levelNodes.has(level)) levelNodes.set(level, []);
    levelNodes.get(level).push(nodeId);
  });

  const maxLevel = Math.max(...levels.values(), 0);
  const padding = 80;
  const levelHeight = (height - padding * 2) / (maxLevel + 1);
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  levelNodes.forEach((nodeIds, level) => {
    const nodeWidth = (width - padding * 2) / (nodeIds.length + 1);
    nodeIds.forEach((nodeId, i) => {
      const node = nodeMap.get(nodeId);
      if (node) {
        node.x = padding + nodeWidth * (i + 1);
        node.y = padding + levelHeight * level + levelHeight / 2;
      }
    });
  });

  nodes.forEach(n => { if (!n.x) { n.x = width / 2; n.y = height - padding; } });

  return { nodes, edges };
}

function drawAxiomGraph(ctx, graph, width, height) {
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.translate(graphOffsetX, graphOffsetY);
  ctx.scale(graphScale, graphScale);

  const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));

  // エッジを描画
  graph.edges.forEach(edge => {
    const from = nodeMap.get(edge.from);
    const to = nodeMap.get(edge.to);
    if (!from || !to || !from.x || !to.x) return;

    const style = EDGE_STYLE[edge.type] || { color: '#666', dash: [] };
    ctx.beginPath();
    ctx.setLineDash(style.dash);
    ctx.strokeStyle = style.color;
    ctx.lineWidth = 1.5;
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();

    // 矢印を描画
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const arrowX = to.x - Math.cos(angle) * 30;
    const arrowY = to.y - Math.sin(angle) * 30;
    ctx.beginPath();
    ctx.setLineDash([]);
    ctx.moveTo(arrowX, arrowY);
    ctx.lineTo(arrowX - 10 * Math.cos(angle - 0.4), arrowY - 10 * Math.sin(angle - 0.4));
    ctx.lineTo(arrowX - 10 * Math.cos(angle + 0.4), arrowY - 10 * Math.sin(angle + 0.4));
    ctx.closePath();
    ctx.fillStyle = style.color;
    ctx.fill();

    // エッジラベル
    if (edge.label) {
      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2;
      ctx.fillStyle = '#666';
      ctx.font = '10px monospace';
      ctx.fillText(edge.label, midX, midY);
    }
  });

  // ノードを描画
  graph.nodes.forEach(node => {
    if (!node.x) return;
    const style = DFUMT_GRAPH_STYLE[node.dfumtValue] ||
      { color: '#1a1a2a', border: '#666', shape: 'rect' };
    const isSelected = selectedAxiomNode?.id === node.id;
    const w = 100, h = 36;

    ctx.beginPath();
    ctx.setLineDash([]);

    if (style.shape === 'circle' || style.shape === 'rounded') {
      ctx.roundRect(node.x - w/2, node.y - h/2, w, h, 8);
    } else if (style.shape === 'diamond') {
      ctx.moveTo(node.x, node.y - h/2 - 5);
      ctx.lineTo(node.x + w/2 + 5, node.y);
      ctx.lineTo(node.x, node.y + h/2 + 5);
      ctx.lineTo(node.x - w/2 - 5, node.y);
      ctx.closePath();
    } else {
      ctx.rect(node.x - w/2, node.y - h/2, w, h);
    }

    ctx.fillStyle = style.color;
    ctx.fill();
    ctx.strokeStyle = isSelected ? '#ffffff' : style.border;
    ctx.lineWidth = isSelected ? 3 : 1.5;
    ctx.stroke();

    // ノードテキスト
    ctx.fillStyle = style.border;
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(node.id, node.x, node.y - 5);
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#cccccc';
    ctx.fillText(node.label.slice(0, 10), node.x, node.y + 10);
    ctx.textAlign = 'left';
  });

  ctx.restore();
}

function onGraphClick(e, canvas, ctx) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left - graphOffsetX) / graphScale;
  const y = (e.clientY - rect.top - graphOffsetY) / graphScale;

  if (!axiomGraphData) return;
  const hit = axiomGraphData.nodes.find(n => {
    if (!n.x) return false;
    return Math.abs(n.x - x) < 60 && Math.abs(n.y - y) < 25;
  });

  selectedAxiomNode = hit || null;
  drawAxiomGraph(ctx, axiomGraphData, canvas.width, canvas.height);

  if (hit) showAxiomDetail(hit);
}

function onGraphWheel(e, canvas, ctx) {
  e.preventDefault();
  graphScale = Math.max(0.3, Math.min(3.0, graphScale - e.deltaY * 0.001));
  drawAxiomGraph(ctx, axiomGraphData, canvas.width, canvas.height);
}

function onGraphHover(e, canvas) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left - graphOffsetX) / graphScale;
  const y = (e.clientY - rect.top - graphOffsetY) / graphScale;

  if (!axiomGraphData) return;
  const hit = axiomGraphData.nodes.find(n => {
    if (!n.x) return false;
    return Math.abs(n.x - x) < 60 && Math.abs(n.y - y) < 25;
  });
  canvas.style.cursor = hit ? 'pointer' : 'grab';
}

function showAxiomDetail(node) {
  const detail = document.getElementById('axiom-detail-panel');
  if (!detail) return;
  const style = DFUMT_GRAPH_STYLE[node.dfumtValue] ||
    { color: '#1a1a2a', border: '#666' };

  detail.innerHTML = \`
    <div style="border-left:4px solid \${style.border};padding:0.5rem 0.75rem;background:#1a1a22;border-radius:6px">
      <div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.4rem">
        <span style="font-size:1rem;color:\${style.border};font-weight:bold">\${node.id}</span>
        <span style="background:\${style.border};color:#fff;font-size:0.72rem;padding:1px 8px;border-radius:4px">
          \${node.dfumtValue}
        </span>
        <span style="color:#666;font-size:0.75rem">\${node.category}</span>
      </div>
      <div style="color:#ccc;font-size:0.9rem;margin-bottom:0.3rem">\${node.label}</div>
      <div style="color:#888;font-size:0.82rem">\${node.description}</div>
    </div>
  \`;
}

function resetGraphView() {
  graphScale = 1.0;
  graphOffsetX = 0;
  graphOffsetY = 0;
  const canvas = document.getElementById('axiom-graph-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    drawAxiomGraph(ctx, axiomGraphData, canvas.width, canvas.height);
  }
}
`;
  }
}
