/**
 * Rei-AIOS STEP 13-C — DFUMTCalculator
 * D-FUMT七価論理の演算エンジン
 *
 * LLMではなく純粋な数学的演算で確定的に計算する。
 * これがReiがLLMと根本的に異なる点。
 */

import type { DFUMTValue } from '../memory/aios-memory';

export type DFUMTOperator = 'AND' | 'OR' | 'NOT' | 'IMPLIES' | 'EQUIV' | 'NAND' | 'NOR';

export interface CalcResult {
  left?: DFUMTValue;
  operator: DFUMTOperator;
  right?: DFUMTValue;
  result: DFUMTValue;
  formula: string;       // 記号式 例: "⊤ ∧ B = B"
  explanation: string;   // 日本語説明
  confidence: 100;       // 常に100%（LLMと異なり確定的）
}

// ─── 七価論理の値を数値にマッピング ──────────────────────────
const VALUE_ORDER: Record<DFUMTValue, number> = {
  FALSE:    1,
  ZERO:     2,
  NEITHER:  3,
  FLOWING:  4,
  BOTH:     5,
  TRUE:     6,
  INFINITY: 7,
};

const SYMBOL: Record<DFUMTValue, string> = {
  TRUE: '⊤', FALSE: '⊥', BOTH: 'B', NEITHER: 'N',
  INFINITY: '∞', ZERO: '〇', FLOWING: '～',
};

const ALL_VALUES: DFUMTValue[] = [
  'TRUE', 'FALSE', 'BOTH', 'NEITHER', 'INFINITY', 'ZERO', 'FLOWING'
];

// ─── AND演算テーブル（論理積）────────────────────────────────
// 低い方の値を返す（悲観的結合）
const AND_TABLE: Record<DFUMTValue, Record<DFUMTValue, DFUMTValue>> = (() => {
  const table: any = {};
  for (const a of ALL_VALUES) {
    table[a] = {};
    for (const b of ALL_VALUES) {
      if (a === 'INFINITY' || b === 'INFINITY') {
        table[a][b] = a === 'INFINITY' ? b : a;
      } else if (a === 'ZERO' || b === 'ZERO') {
        table[a][b] = 'ZERO';
      } else if (a === 'BOTH' && b === 'BOTH') {
        table[a][b] = 'BOTH';
      } else if (a === 'NEITHER' || b === 'NEITHER') {
        table[a][b] = 'NEITHER';
      } else if (a === 'FLOWING' || b === 'FLOWING') {
        table[a][b] = 'FLOWING';
      } else {
        table[a][b] = VALUE_ORDER[a] <= VALUE_ORDER[b] ? a : b;
      }
    }
  }
  return table;
})();

// ─── OR演算テーブル（論理和）─────────────────────────────────
const OR_TABLE: Record<DFUMTValue, Record<DFUMTValue, DFUMTValue>> = (() => {
  const table: any = {};
  for (const a of ALL_VALUES) {
    table[a] = {};
    for (const b of ALL_VALUES) {
      if (a === 'INFINITY' || b === 'INFINITY') {
        table[a][b] = 'INFINITY';
      } else if (a === 'ZERO' && b === 'ZERO') {
        table[a][b] = 'ZERO';
      } else if (a === 'ZERO') {
        table[a][b] = b;
      } else if (b === 'ZERO') {
        table[a][b] = a;
      } else if (a === 'BOTH' || b === 'BOTH') {
        table[a][b] = 'BOTH';
      } else if (a === 'NEITHER' && b === 'NEITHER') {
        table[a][b] = 'NEITHER';
      } else if (a === 'FLOWING' || b === 'FLOWING') {
        table[a][b] = 'FLOWING';
      } else {
        table[a][b] = VALUE_ORDER[a] >= VALUE_ORDER[b] ? a : b;
      }
    }
  }
  return table;
})();

// ─── NOT演算テーブル（否定）─────────────────────────────────
const NOT_TABLE: Record<DFUMTValue, DFUMTValue> = {
  TRUE:     'FALSE',
  FALSE:    'TRUE',
  BOTH:     'NEITHER',
  NEITHER:  'BOTH',
  INFINITY: 'ZERO',
  ZERO:     'INFINITY',
  FLOWING:  'FLOWING',
};

// ─── IMPLIES演算テーブル（含意）─────────────────────────────
const IMPLIES_TABLE: Record<DFUMTValue, Record<DFUMTValue, DFUMTValue>> = (() => {
  const table: any = {};
  for (const a of ALL_VALUES) {
    table[a] = {};
    for (const b of ALL_VALUES) {
      table[a][b] = OR_TABLE[NOT_TABLE[a]][b];
    }
  }
  return table;
})();

// ─── EQUIV演算テーブル（同値）────────────────────────────────
const EQUIV_TABLE: Record<DFUMTValue, Record<DFUMTValue, DFUMTValue>> = (() => {
  const table: any = {};
  for (const a of ALL_VALUES) {
    table[a] = {};
    for (const b of ALL_VALUES) {
      if (a === b) {
        table[a][b] = 'TRUE';
      } else if (
        (a === 'TRUE' && b === 'FALSE') ||
        (a === 'FALSE' && b === 'TRUE')
      ) {
        table[a][b] = 'FALSE';
      } else {
        table[a][b] = 'NEITHER';
      }
    }
  }
  return table;
})();

// ─── 日本語説明生成 ──────────────────────────────────────────
function explain(
  op: DFUMTOperator,
  left: DFUMTValue | undefined,
  right: DFUMTValue | undefined,
  result: DFUMTValue
): string {
  const ln = left ? `「${left}」` : '';
  const rn = right ? `「${right}」` : '';
  const res = `「${result}」`;

  switch (op) {
    case 'AND':
      return `${ln}と${rn}の論理積は${res}。両者の共通部分を取ります。`;
    case 'OR':
      return `${ln}と${rn}の論理和は${res}。両者の合わせた範囲です。`;
    case 'NOT':
      return `${ln}の否定は${res}。七価論理における反転です。`;
    case 'IMPLIES':
      return `${ln}ならば${rn}、この含意の値は${res}。`;
    case 'EQUIV':
      return `${ln}と${rn}の同値性は${res}。`;
    case 'NAND':
      return `${ln}と${rn}のNAND（ANDの否定）は${res}。`;
    case 'NOR':
      return `${ln}と${rn}のNOR（ORの否定）は${res}。`;
    default:
      return `演算結果: ${res}`;
  }
}

// ─── DFUMTCalculator メインクラス ────────────────────────────
export class DFUMTCalculator {

  // ── 二項演算 ────────────────────────────────────────────
  calculate(
    left: DFUMTValue,
    op: DFUMTOperator,
    right: DFUMTValue
  ): CalcResult {
    let result: DFUMTValue;
    let opSymbol: string;

    switch (op) {
      case 'AND':
        result = AND_TABLE[left][right];
        opSymbol = '∧';
        break;
      case 'OR':
        result = OR_TABLE[left][right];
        opSymbol = '∨';
        break;
      case 'IMPLIES':
        result = IMPLIES_TABLE[left][right];
        opSymbol = '→';
        break;
      case 'EQUIV':
        result = EQUIV_TABLE[left][right];
        opSymbol = '↔';
        break;
      case 'NAND':
        result = NOT_TABLE[AND_TABLE[left][right]];
        opSymbol = '⊼';
        break;
      case 'NOR':
        result = NOT_TABLE[OR_TABLE[left][right]];
        opSymbol = '⊽';
        break;
      default:
        result = 'NEITHER';
        opSymbol = '?';
    }

    return {
      left, operator: op, right, result,
      formula: `${SYMBOL[left]} ${opSymbol} ${SYMBOL[right]} = ${SYMBOL[result]}`,
      explanation: explain(op, left, right, result),
      confidence: 100,
    };
  }

  // ── 単項演算（NOT） ──────────────────────────────────────
  not(value: DFUMTValue): CalcResult {
    const result = NOT_TABLE[value];
    return {
      operator: 'NOT',
      left: value,
      result,
      formula: `¬${SYMBOL[value]} = ${SYMBOL[result]}`,
      explanation: explain('NOT', value, undefined, result),
      confidence: 100,
    };
  }

  // ── 全演算テーブル取得 ──────────────────────────────────
  getFullTable(op: 'AND' | 'OR' | 'IMPLIES' | 'EQUIV' | 'NAND' | 'NOR'): {
    values: DFUMTValue[];
    table: DFUMTValue[][];
  } {
    const tables: Record<string, any> = {
      AND: AND_TABLE, OR: OR_TABLE,
      IMPLIES: IMPLIES_TABLE, EQUIV: EQUIV_TABLE,
    };

    let tableData: any;
    if (op === 'NAND') {
      tableData = {} as any;
      for (const a of ALL_VALUES) {
        tableData[a] = {};
        for (const b of ALL_VALUES) {
          tableData[a][b] = NOT_TABLE[AND_TABLE[a][b]];
        }
      }
    } else if (op === 'NOR') {
      tableData = {} as any;
      for (const a of ALL_VALUES) {
        tableData[a] = {};
        for (const b of ALL_VALUES) {
          tableData[a][b] = NOT_TABLE[OR_TABLE[a][b]];
        }
      }
    } else {
      tableData = tables[op];
    }

    const table = ALL_VALUES.map(a =>
      ALL_VALUES.map(b => tableData[a][b] as DFUMTValue)
    );

    return { values: ALL_VALUES, table };
  }

  // ── 式の評価（複数演算） ────────────────────────────────
  evaluate(expression: { left: DFUMTValue; op: DFUMTOperator; right: DFUMTValue }[]): DFUMTValue {
    if (expression.length === 0) return 'NEITHER';
    let result = this.calculate(
      expression[0].left, expression[0].op, expression[0].right
    ).result;
    for (let i = 1; i < expression.length; i++) {
      result = this.calculate(result, expression[i].op, expression[i].right).result;
    }
    return result;
  }

  get allValues(): DFUMTValue[] { return ALL_VALUES; }
  get symbols(): Record<DFUMTValue, string> { return SYMBOL; }
  get valueOrder(): Record<DFUMTValue, number> { return VALUE_ORDER; }
}

// ─── 色取得ヘルパー ──────────────────────────────────────────
function getDFUMTColor(v: string): string {
  const colors: Record<string, string> = {
    TRUE:'#88aaff', FALSE:'#cc6677', BOTH:'#aa88ff',
    NEITHER:'#888888', INFINITY:'#ffaa44', ZERO:'#44aacc', FLOWING:'#88ccaa'
  };
  return colors[v] || '#666';
}

// ─── WebUIパネル生成 ──────────────────────────────────────────
export function generateCalculatorPanel(): string {
  const calc = new DFUMTCalculator();

  return `
<!-- ⬡ 七価論理計算機パネル -->
<div id="panel-calculator" class="panel" style="display:none">
  <div class="calc-container">

    <!-- 計算機 -->
    <div class="calc-section">
      <div class="calc-title">⬡ D-FUMT七価論理 演算計算機</div>
      <div class="calc-subtitle">LLMではなく数学的に確定計算（確信度常に100%）</div>

      <div class="calc-input-row">
        <!-- 単項演算（NOT） -->
        <div class="calc-unary">
          <div class="calc-label">単項演算（NOT）</div>
          <div class="calc-row">
            <span class="calc-not-symbol">¬</span>
            <select id="calc-not-val" class="calc-select">
              ${calc.allValues.map(v =>
                `<option value="${v}">${calc.symbols[v]} ${v}</option>`
              ).join('')}
            </select>
            <button onclick="calcNot()" class="btn-calc">=</button>
            <span id="calc-not-result" class="calc-result-badge">?</span>
          </div>
        </div>

        <!-- 二項演算 -->
        <div class="calc-binary">
          <div class="calc-label">二項演算</div>
          <div class="calc-row">
            <select id="calc-left" class="calc-select">
              ${calc.allValues.map(v =>
                `<option value="${v}">${calc.symbols[v]} ${v}</option>`
              ).join('')}
            </select>
            <select id="calc-op" class="calc-select calc-op-select">
              <option value="AND">∧ AND</option>
              <option value="OR">∨ OR</option>
              <option value="IMPLIES">→ IMPLIES</option>
              <option value="EQUIV">↔ EQUIV</option>
              <option value="NAND">⊼ NAND</option>
              <option value="NOR">⊽ NOR</option>
            </select>
            <select id="calc-right" class="calc-select">
              ${calc.allValues.map(v =>
                `<option value="${v}">${calc.symbols[v]} ${v}</option>`
              ).join('')}
            </select>
            <button onclick="calcBinary()" class="btn-calc">=</button>
            <span id="calc-binary-result" class="calc-result-badge">?</span>
          </div>
        </div>
      </div>

      <!-- 計算結果表示 -->
      <div id="calc-detail" class="calc-detail"></div>
    </div>

    <!-- 演算テーブル -->
    <div class="calc-section">
      <div class="calc-title">演算テーブル（色で確認）</div>
      <div class="calc-table-controls">
        <select id="table-op" onchange="renderOpTable()" class="calc-select">
          <option value="AND">∧ AND（論理積）</option>
          <option value="OR">∨ OR（論理和）</option>
          <option value="IMPLIES">→ IMPLIES（含意）</option>
          <option value="EQUIV">↔ EQUIV（同値）</option>
          <option value="NAND">⊼ NAND</option>
          <option value="NOR">⊽ NOR</option>
        </select>
      </div>
      <div id="op-table-container" class="op-table-container"></div>
    </div>

    <!-- 凡例 -->
    <div class="calc-legend">
      ${calc.allValues.map(v => `
        <span class="legend-item">
          <span class="legend-dot" style="background:${getDFUMTColor(v)}"></span>
          ${calc.symbols[v]} ${v}
        </span>
      `).join('')}
    </div>
  </div>
</div>

<style>
.calc-container { display: flex; flex-direction: column; gap: 1rem; }
.calc-section {
  background: #111115; border-radius: 10px; padding: 1rem;
}
.calc-title { font-size: 0.9rem; color: var(--highlight); margin-bottom: 0.2rem; }
.calc-subtitle { font-size: 0.72rem; color: #555; margin-bottom: 0.75rem; }
.calc-label { font-size: 0.78rem; color: #888; margin-bottom: 0.3rem; }
.calc-input-row { display: flex; gap: 1rem; flex-wrap: wrap; }
.calc-unary, .calc-binary { flex: 1; min-width: 200px; }
.calc-row { display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap; }
.calc-select {
  background: var(--surface); color: var(--text);
  border: 1px solid #444; border-radius: 6px;
  padding: 0.3rem 0.5rem; font-size: 0.85rem;
}
.calc-op-select { min-width: 120px; }
.calc-not-symbol { font-size: 1.2rem; color: var(--accent); }
.btn-calc {
  background: var(--accent); color: #fff;
  border: none; border-radius: 6px;
  padding: 0.3rem 0.8rem; cursor: pointer; font-size: 0.9rem;
}
.calc-result-badge {
  font-size: 1rem; font-weight: bold;
  padding: 0.2rem 0.6rem; border-radius: 6px;
  background: #2a2a3a; color: var(--highlight);
  min-width: 60px; text-align: center;
}
.calc-detail {
  margin-top: 0.75rem; padding: 0.6rem;
  background: #1a1a22; border-radius: 6px;
  font-size: 0.85rem; color: #aaa; min-height: 2rem;
}
.calc-table-controls { margin-bottom: 0.5rem; }
.op-table-container { overflow-x: auto; }
.op-table { border-collapse: collapse; font-size: 0.8rem; }
.op-table th, .op-table td {
  border: 1px solid #333; padding: 6px 10px;
  text-align: center; min-width: 70px;
}
.op-table th { background: #1a1a2a; color: #aaa; }
.op-table td { font-weight: bold; }
.calc-legend {
  display: flex; flex-wrap: wrap; gap: 0.5rem;
  font-size: 0.78rem; color: #888;
}
.legend-item { display: flex; align-items: center; gap: 0.3rem; }
.legend-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
</style>
`;
}

// ─── WebUIスクリプト生成 ──────────────────────────────────────
export function generateCalculatorScript(): string {
  return `
// ─── STEP 13-C: 七価論理計算機スクリプト ──────────────────────
const DFUMT_COLORS_CALC = {
  TRUE:'#88aaff', FALSE:'#cc6677', BOTH:'#aa88ff',
  NEITHER:'#888888', INFINITY:'#ffaa44', ZERO:'#44aacc', FLOWING:'#88ccaa'
};
const DFUMT_SYMBOLS_CALC = {
  TRUE:'⊤', FALSE:'⊥', BOTH:'B', NEITHER:'N',
  INFINITY:'∞', ZERO:'〇', FLOWING:'～'
};

const AND_T = ${JSON.stringify(AND_TABLE)};
const OR_T = buildOrTable();
const IMPLIES_T = buildImpliesTable();
const EQUIV_T = buildEquivTable();
const NOT_T = ${JSON.stringify(NOT_TABLE)};
const ALL_VALS = ['TRUE','FALSE','BOTH','NEITHER','INFINITY','ZERO','FLOWING'];

function buildOrTable() {
  const t = {};
  for (const a of ALL_VALS) { t[a] = {};
    for (const b of ALL_VALS) {
      if (a==='INFINITY'||b==='INFINITY') t[a][b]='INFINITY';
      else if (a==='ZERO'&&b==='ZERO') t[a][b]='ZERO';
      else if (a==='ZERO') t[a][b]=b;
      else if (b==='ZERO') t[a][b]=a;
      else if (a==='BOTH'||b==='BOTH') t[a][b]='BOTH';
      else if (a==='NEITHER'&&b==='NEITHER') t[a][b]='NEITHER';
      else if (a==='FLOWING'||b==='FLOWING') t[a][b]='FLOWING';
      else {
        const order = {FALSE:1,ZERO:2,NEITHER:3,FLOWING:4,BOTH:5,TRUE:6,INFINITY:7};
        t[a][b] = order[a]>=order[b]?a:b;
      }
    }
  }
  return t;
}
function buildImpliesTable() {
  const t = {};
  for (const a of ALL_VALS) { t[a] = {};
    for (const b of ALL_VALS) { t[a][b] = OR_T[NOT_T[a]][b]; }
  }
  return t;
}
function buildEquivTable() {
  const t = {};
  for (const a of ALL_VALS) { t[a] = {};
    for (const b of ALL_VALS) {
      if (a===b) t[a][b]='TRUE';
      else if ((a==='TRUE'&&b==='FALSE')||(a==='FALSE'&&b==='TRUE')) t[a][b]='FALSE';
      else t[a][b]='NEITHER';
    }
  }
  return t;
}

function getTableForOp(op) {
  if (op==='AND') return AND_T;
  if (op==='OR') return OR_T;
  if (op==='IMPLIES') return IMPLIES_T;
  if (op==='EQUIV') return EQUIV_T;
  if (op==='NAND') {
    const t={};
    for(const a of ALL_VALS){t[a]={};for(const b of ALL_VALS)t[a][b]=NOT_T[AND_T[a][b]];}
    return t;
  }
  if (op==='NOR') {
    const t={};
    for(const a of ALL_VALS){t[a]={};for(const b of ALL_VALS)t[a][b]=NOT_T[OR_T[a][b]];}
    return t;
  }
  return AND_T;
}

function calcNot() {
  const val = document.getElementById('calc-not-val').value;
  const result = NOT_T[val];
  const badge = document.getElementById('calc-not-result');
  badge.textContent = DFUMT_SYMBOLS_CALC[result] + ' ' + result;
  badge.style.background = DFUMT_COLORS_CALC[result];
  badge.style.color = '#fff';
  document.getElementById('calc-detail').innerHTML =
    '<strong>¬' + DFUMT_SYMBOLS_CALC[val] + ' = ' + DFUMT_SYMBOLS_CALC[result] + '</strong>' +
    '（' + val + 'の否定は' + result + '）確信度: 100%';
}

function calcBinary() {
  const left = document.getElementById('calc-left').value;
  const op = document.getElementById('calc-op').value;
  const right = document.getElementById('calc-right').value;
  const table = getTableForOp(op);
  const result = table[left][right];
  const badge = document.getElementById('calc-binary-result');
  badge.textContent = DFUMT_SYMBOLS_CALC[result] + ' ' + result;
  badge.style.background = DFUMT_COLORS_CALC[result];
  badge.style.color = '#fff';

  const opSymbols = {AND:'∧',OR:'∨',IMPLIES:'→',EQUIV:'↔',NAND:'⊼',NOR:'⊽'};
  const sym = opSymbols[op] || op;
  document.getElementById('calc-detail').innerHTML =
    '<strong>' + DFUMT_SYMBOLS_CALC[left] + ' ' + sym + ' ' + DFUMT_SYMBOLS_CALC[right] +
    ' = ' + DFUMT_SYMBOLS_CALC[result] + '</strong><br>' +
    '(' + left + ' ' + op + ' ' + right + ' = ' + result + ')<br>' +
    '<span style="color:#888">確信度: 100%（数学的確定計算）</span>';
}

function renderOpTable() {
  const op = document.getElementById('table-op').value;
  const table = getTableForOp(op);
  let html = '<table class="op-table"><tr><th>A \\\\ B</th>';
  for (const b of ALL_VALS) {
    html += '<th style="color:' + DFUMT_COLORS_CALC[b] + '">' + DFUMT_SYMBOLS_CALC[b] + '</th>';
  }
  html += '</tr>';
  for (const a of ALL_VALS) {
    html += '<tr><th style="color:' + DFUMT_COLORS_CALC[a] + '">' + DFUMT_SYMBOLS_CALC[a] + '</th>';
    for (const b of ALL_VALS) {
      const r = table[a][b];
      html += '<td style="background:' + DFUMT_COLORS_CALC[r] + '22;color:' + DFUMT_COLORS_CALC[r] + '">' +
        DFUMT_SYMBOLS_CALC[r] + '</td>';
    }
    html += '</tr>';
  }
  html += '</table>';
  document.getElementById('op-table-container').innerHTML = html;
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('op-table-container')) renderOpTable();
});
`;
}

// テーブルをexport
export { AND_TABLE, NOT_TABLE, OR_TABLE, IMPLIES_TABLE, EQUIV_TABLE };
export { ALL_VALUES, SYMBOL };
