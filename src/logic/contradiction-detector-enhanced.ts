/**
 * Rei-AIOS STEP 13-D — ContradictionDetectorEnhanced
 * D-FUMT七価論理による矛盾検出エンジン（強化版）
 */

import { DFUMTCalculator, AND_TABLE, NOT_TABLE } from './dfumt-calculator';
import type { DFUMTValue } from '../memory/aios-memory';

export interface AxiomStatement {
  id: string;
  content: string;
  dfumtValue: DFUMTValue;
  category: string;
  keywords: string[];
}

export type ContradictionLevel =
  | 'NONE'        // 矛盾なし
  | 'WEAK'        // 弱い矛盾（注意）
  | 'MODERATE'    // 中程度の矛盾（要検討）
  | 'STRONG'      // 強い矛盾（要修正）
  | 'CRITICAL';   // 致命的矛盾（即修正必要）

export interface ContradictionResult {
  axiomA: AxiomStatement;
  axiomB: AxiomStatement;
  level: ContradictionLevel;
  score: number;               // 0〜100（矛盾スコア）
  dfumtAnalysis: DFUMTValue;   // AND演算の結果
  reason: string;
  suggestions: string[];
  canCoexist: boolean;
}

export interface DetectionReport {
  totalPairs: number;
  contradictions: ContradictionResult[];
  summary: {
    critical: number;
    strong: number;
    moderate: number;
    weak: number;
    none: number;
  };
  overallHealth: DFUMTValue;   // 公理体系全体の健全性
  healthScore: number;          // 0〜100
}

// ─── ContradictionDetectorEnhanced メインクラス ──────────────
export class ContradictionDetectorEnhanced {
  private calc: DFUMTCalculator;

  constructor() {
    this.calc = new DFUMTCalculator();
  }

  // ── 2つの公理の矛盾を検出 ──────────────────────────────
  detectPair(
    axiomA: AxiomStatement,
    axiomB: AxiomStatement
  ): ContradictionResult {
    const andResult = this.calc.calculate(axiomA.dfumtValue, 'AND', axiomB.dfumtValue);
    const equivResult = this.calc.calculate(axiomA.dfumtValue, 'EQUIV', axiomB.dfumtValue);

    const keywordOverlap = axiomA.keywords.filter(k =>
      axiomB.keywords.some(k2 =>
        k === k2 || k.includes(k2) || k2.includes(k)
      )
    ).length;

    const sameCategory = axiomA.category === axiomB.category;

    const score = this._calcScore(
      axiomA.dfumtValue,
      axiomB.dfumtValue,
      andResult.result,
      equivResult.result,
      keywordOverlap,
      sameCategory
    );

    const level = this._scoreToLevel(score);
    const canCoexist = this._canCoexist(axiomA.dfumtValue, axiomB.dfumtValue);

    const suggestions = this._generateSuggestions(
      axiomA, axiomB, level, andResult.result
    );

    return {
      axiomA, axiomB,
      level, score,
      dfumtAnalysis: andResult.result,
      reason: this._buildReason(axiomA, axiomB, andResult.result, equivResult.result),
      suggestions,
      canCoexist,
    };
  }

  // ── 複数公理の一括検出 ──────────────────────────────────
  detectAll(axioms: AxiomStatement[]): DetectionReport {
    const contradictions: ContradictionResult[] = [];
    const summary = { critical: 0, strong: 0, moderate: 0, weak: 0, none: 0 };

    for (let i = 0; i < axioms.length; i++) {
      for (let j = i + 1; j < axioms.length; j++) {
        const result = this.detectPair(axioms[i], axioms[j]);
        if (result.level !== 'NONE') {
          contradictions.push(result);
        }
        summary[result.level.toLowerCase() as keyof typeof summary]++;
      }
    }

    const totalPairs = (axioms.length * (axioms.length - 1)) / 2;
    const problemPairs = summary.critical * 4 + summary.strong * 3 +
      summary.moderate * 2 + summary.weak;
    const healthScore = Math.max(0, 100 - (problemPairs / totalPairs) * 100);
    const overallHealth = this._scoreToDFUMT(healthScore);

    return {
      totalPairs,
      contradictions: contradictions.sort((a, b) => b.score - a.score),
      summary,
      overallHealth,
      healthScore: Math.round(healthScore),
    };
  }

  // ── スコア計算 ────────────────────────────────────────────
  private _calcScore(
    valA: DFUMTValue,
    valB: DFUMTValue,
    andResult: DFUMTValue,
    equivResult: DFUMTValue,
    keywordOverlap: number,
    sameCategory: boolean
  ): number {
    let score = 0;

    const contradictoryPairs: [DFUMTValue, DFUMTValue][] = [
      ['TRUE', 'FALSE'],
      ['INFINITY', 'ZERO'],
      ['BOTH', 'NEITHER'],
    ];

    const isDirectContradict = contradictoryPairs.some(
      ([a, b]) => (valA === a && valB === b) || (valA === b && valB === a)
    );

    if (isDirectContradict) score += 60;
    else if (equivResult === 'FALSE') score += 40;
    else if (andResult === 'ZERO') score += 30;
    else if (andResult === 'NEITHER') score += 20;
    else if (andResult === 'FLOWING') score += 10;

    if (keywordOverlap > 3) score += 20;
    else if (keywordOverlap > 1) score += 10;
    else if (keywordOverlap > 0) score += 5;

    if (sameCategory && score > 20) score += 15;

    return Math.min(100, score);
  }

  private _scoreToLevel(score: number): ContradictionLevel {
    if (score >= 80) return 'CRITICAL';
    if (score >= 60) return 'STRONG';
    if (score >= 35) return 'MODERATE';
    if (score >= 15) return 'WEAK';
    return 'NONE';
  }

  private _canCoexist(a: DFUMTValue, b: DFUMTValue): boolean {
    const cannotCoexist: [DFUMTValue, DFUMTValue][] = [
      ['TRUE', 'FALSE'],
      ['INFINITY', 'ZERO'],
    ];
    return !cannotCoexist.some(
      ([x, y]) => (a === x && b === y) || (a === y && b === x)
    );
  }

  private _buildReason(
    a: AxiomStatement,
    b: AxiomStatement,
    andResult: DFUMTValue,
    equivResult: DFUMTValue
  ): string {
    if (equivResult === 'FALSE') {
      return `${a.dfumtValue}と${b.dfumtValue}は論理的に相反します。AND演算結果: ${andResult}`;
    }
    if (andResult === 'ZERO') {
      return `両公理のANDがZERO（無）になります。内容が互いを打ち消しています。`;
    }
    if (andResult === 'NEITHER') {
      return `両公理のANDがNEITHER（不定）になります。論理的に不確定な関係です。`;
    }
    return `D-FUMT演算: ${a.dfumtValue} ∧ ${b.dfumtValue} = ${andResult}`;
  }

  private _generateSuggestions(
    a: AxiomStatement,
    b: AxiomStatement,
    level: ContradictionLevel,
    andResult: DFUMTValue
  ): string[] {
    const suggestions: string[] = [];

    if (level === 'CRITICAL') {
      suggestions.push(`${a.id}または${b.id}のD-FUMT値を再検討してください`);
      suggestions.push(`いずれかをBOTHまたはFLOWINGに変更することで共存可能になります`);
      suggestions.push(`両公理の適用範囲を明確に分離することを推奨します`);
    } else if (level === 'STRONG') {
      suggestions.push(`${a.id}と${b.id}の関係を「extends」または「derives」で明示してください`);
      suggestions.push(`統合公理として新しいTheoryを作成することを検討してください`);
    } else if (level === 'MODERATE') {
      suggestions.push(`適用条件を明確にすることで矛盾を解消できます`);
      suggestions.push(`D-FUMT値をFLOWINGにすることで流動的共存が可能です`);
    } else {
      suggestions.push(`注意レベルの矛盾です。継続してモニタリングしてください`);
    }

    return suggestions;
  }

  private _scoreToDFUMT(score: number): DFUMTValue {
    if (score >= 90) return 'TRUE';
    if (score >= 75) return 'FLOWING';
    if (score >= 60) return 'BOTH';
    if (score >= 40) return 'NEITHER';
    if (score >= 20) return 'FALSE';
    return 'ZERO';
  }
}

// ─── WebUIパネル生成 ──────────────────────────────────────────
export function generateContradictionPanel(): string {
  return `
<!-- ⬡ 矛盾検出パネル -->
<div id="panel-contradiction" class="panel" style="display:none">
  <div class="contra-container">
    <div class="contra-header">
      <div class="contra-title">⬡ D-FUMT矛盾検出エンジン（強化版）</div>
      <div class="contra-subtitle">七価論理で公理どうしの矛盾を数学的に検出</div>
    </div>

    <!-- 手動検出 -->
    <div class="contra-section">
      <div class="contra-section-title">2公理の矛盾チェック</div>
      <div class="contra-pair-input">
        <div class="contra-axiom-input">
          <div class="contra-label">公理 A</div>
          <input type="text" id="contra-a-id" placeholder="ID（例: Theory #1）" class="contra-input"/>
          <input type="text" id="contra-a-content" placeholder="内容..." class="contra-input"/>
          <select id="contra-a-val" class="calc-select">
            <option value="TRUE">⊤ TRUE</option>
            <option value="FALSE">⊥ FALSE</option>
            <option value="BOTH">B BOTH</option>
            <option value="NEITHER">N NEITHER</option>
            <option value="INFINITY">∞ INFINITY</option>
            <option value="ZERO">〇 ZERO</option>
            <option value="FLOWING">～ FLOWING</option>
          </select>
        </div>
        <div class="contra-vs">VS</div>
        <div class="contra-axiom-input">
          <div class="contra-label">公理 B</div>
          <input type="text" id="contra-b-id" placeholder="ID（例: Theory #2）" class="contra-input"/>
          <input type="text" id="contra-b-content" placeholder="内容..." class="contra-input"/>
          <select id="contra-b-val" class="calc-select">
            <option value="TRUE">⊤ TRUE</option>
            <option value="BOTH">B BOTH</option>
            <option value="FALSE">⊥ FALSE</option>
            <option value="NEITHER">N NEITHER</option>
            <option value="INFINITY">∞ INFINITY</option>
            <option value="ZERO">〇 ZERO</option>
            <option value="FLOWING">～ FLOWING</option>
          </select>
        </div>
      </div>
      <button onclick="checkContradiction()" class="btn-nostr-primary" style="margin-top:0.5rem">
        ⬡ 矛盾を検出
      </button>
      <div id="contra-result" class="contra-result"></div>
    </div>

    <!-- SEED_KERNEL一括検出 -->
    <div class="contra-section">
      <div class="contra-section-title">SEED_KERNEL 全体健全性レポート</div>
      <button onclick="runFullDetection()" class="btn-nostr-primary">
        全公理の矛盾を一括検出
      </button>
      <div id="contra-report" class="contra-report"></div>
    </div>
  </div>
</div>

<style>
.contra-container { display: flex; flex-direction: column; gap: 0.75rem; }
.contra-header { border-bottom: 1px solid #333; padding-bottom: 0.5rem; }
.contra-title { font-size: 0.95rem; color: var(--highlight); }
.contra-subtitle { font-size: 0.72rem; color: #555; }
.contra-section { background: #111115; border-radius: 10px; padding: 0.75rem; }
.contra-section-title { font-size: 0.85rem; color: #aaa; margin-bottom: 0.5rem; }
.contra-pair-input { display: flex; gap: 0.75rem; align-items: flex-start; flex-wrap: wrap; }
.contra-axiom-input { flex: 1; display: flex; flex-direction: column; gap: 0.3rem; min-width: 150px; }
.contra-label { font-size: 0.78rem; color: #888; }
.contra-input {
  background: var(--surface); color: var(--text);
  border: 1px solid #444; border-radius: 6px;
  padding: 0.4rem 0.6rem; font-size: 0.85rem; width: 100%;
}
.contra-vs {
  font-size: 1.2rem; color: #cc6677; font-weight: bold;
  align-self: center; padding: 0 0.5rem;
}
.contra-result { margin-top: 0.75rem; }
.contra-report { margin-top: 0.75rem; }
.contra-level-badge {
  padding: 2px 10px; border-radius: 4px;
  font-size: 0.8rem; font-weight: bold;
}
.contra-item {
  background: #1a1a22; border-radius: 8px;
  padding: 0.6rem; margin-bottom: 0.5rem;
}
.health-bar {
  height: 12px; border-radius: 6px;
  background: #222; overflow: hidden; margin: 0.4rem 0;
}
.health-fill { height: 100%; border-radius: 6px; transition: width 0.5s; }
</style>
`;
}

// ─── WebUIスクリプト生成 ──────────────────────────────────────
export function generateContradictionScript(): string {
  return `
// ─── STEP 13-D: 矛盾検出エンジンスクリプト ──────────────────
const LEVEL_COLORS = {
  CRITICAL:'#cc3344', STRONG:'#cc6633',
  MODERATE:'#aaaa33', WEAK:'#4488aa', NONE:'#33aa66'
};
const LEVEL_LABELS = {
  CRITICAL:'致命的矛盾', STRONG:'強い矛盾',
  MODERATE:'中程度の矛盾', WEAK:'弱い矛盾', NONE:'矛盾なし'
};

const CALC_AND = ${JSON.stringify(AND_TABLE)};
const CALC_NOT = ${JSON.stringify(NOT_TABLE)};

function dfumtAnd(a, b) { return CALC_AND[a]?.[b] || 'NEITHER'; }
function dfumtEquiv(a, b) {
  if (a===b) return 'TRUE';
  if ((a==='TRUE'&&b==='FALSE')||(a==='FALSE'&&b==='TRUE')) return 'FALSE';
  return 'NEITHER';
}

function calcContraScore(valA, valB) {
  var score = 0;
  var pairs = [['TRUE','FALSE'],['INFINITY','ZERO'],['BOTH','NEITHER']];
  if (pairs.some(function(p){return(valA===p[0]&&valB===p[1])||(valA===p[1]&&valB===p[0]);})) score+=60;
  else if (dfumtEquiv(valA,valB)==='FALSE') score+=40;
  else if (dfumtAnd(valA,valB)==='ZERO') score+=30;
  else if (dfumtAnd(valA,valB)==='NEITHER') score+=20;
  else if (dfumtAnd(valA,valB)==='FLOWING') score+=10;
  return Math.min(100, score);
}

function scoreToLevel(score) {
  if (score>=80) return 'CRITICAL';
  if (score>=60) return 'STRONG';
  if (score>=35) return 'MODERATE';
  if (score>=15) return 'WEAK';
  return 'NONE';
}

function checkContradiction() {
  var aId = document.getElementById('contra-a-id').value||'公理A';
  var aVal = document.getElementById('contra-a-val').value;
  var bId = document.getElementById('contra-b-id').value||'公理B';
  var bVal = document.getElementById('contra-b-val').value;

  var andResult = dfumtAnd(aVal, bVal);
  var score = calcContraScore(aVal, bVal);
  var level = scoreToLevel(score);
  var col = LEVEL_COLORS[level];
  var sym = {TRUE:'⊤',FALSE:'⊥',BOTH:'B',NEITHER:'N',INFINITY:'∞',ZERO:'〇',FLOWING:'～'};

  document.getElementById('contra-result').innerHTML =
    '<div class="contra-item" style="border-left:4px solid ' + col + '">' +
      '<div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.5rem">' +
        '<span class="contra-level-badge" style="background:' + col + ';color:#fff">' +
          LEVEL_LABELS[level] +
        '</span>' +
        '<span style="font-size:0.85rem;color:#888">矛盾スコア: ' + score + '%</span>' +
      '</div>' +
      '<div style="font-size:0.85rem;margin-bottom:0.4rem">' +
        'D-FUMT演算: <strong>' + sym[aVal] + ' ∧ ' + sym[bVal] + ' = ' + sym[andResult] + '</strong>' +
        ' (' + aVal + ' AND ' + bVal + ' = ' + andResult + ')' +
      '</div>' +
      '<div class="health-bar">' +
        '<div class="health-fill" style="width:' + score + '%;background:' + col + '"></div>' +
      '</div>' +
      '<div style="font-size:0.82rem;color:#888">' +
        aId + '(' + aVal + ') vs ' + bId + '(' + bVal + ')<br>' +
        '共存可能: ' + (score < 70 ? '✓ 可能' : '✗ 要修正') +
      '</div>' +
    '</div>';
}

function runFullDetection() {
  var axioms = [
    { id:'#1', dfumtValue:'TRUE',     category:'logic' },
    { id:'#2', dfumtValue:'BOTH',     category:'logic' },
    { id:'#3', dfumtValue:'NEITHER',  category:'philosophy' },
    { id:'#5', dfumtValue:'FLOWING',  category:'philosophy' },
    { id:'#10', dfumtValue:'ZERO',    category:'mathematics' },
    { id:'#23', dfumtValue:'INFINITY',category:'mathematics' },
    { id:'#45', dfumtValue:'BOTH',    category:'consciousness' },
    { id:'#67', dfumtValue:'TRUE',    category:'compression' },
    { id:'#76', dfumtValue:'FLOWING', category:'mathematics' },
    { id:'#100', dfumtValue:'TRUE',   category:'meta' },
  ];

  var sym = {TRUE:'⊤',FALSE:'⊥',BOTH:'B',NEITHER:'N',INFINITY:'∞',ZERO:'〇',FLOWING:'～'};
  var results = [];
  var critical=0,strong=0,moderate=0,weak=0,none=0;

  for (var i=0;i<axioms.length;i++) {
    for (var j=i+1;j<axioms.length;j++) {
      var score = calcContraScore(axioms[i].dfumtValue, axioms[j].dfumtValue);
      var level = scoreToLevel(score);
      if (level!=='NONE') results.push({id:axioms[i].id, dfumtValue:axioms[i].dfumtValue, bId:axioms[j].id, bVal:axioms[j].dfumtValue, score:score, level:level});
      if (level==='CRITICAL') critical++;
      else if (level==='STRONG') strong++;
      else if (level==='MODERATE') moderate++;
      else if (level==='WEAK') weak++;
      else none++;
    }
  }

  var totalPairs = axioms.length*(axioms.length-1)/2;
  var healthScore = Math.max(0, Math.round(100-(critical*4+strong*3+moderate*2+weak)/totalPairs*100));
  var healthColor = healthScore>=80?'#88ccaa':healthScore>=60?'#aaaa44':'#cc6644';

  var html =
    '<div class="contra-item">' +
      '<div style="font-size:0.9rem;color:var(--highlight);margin-bottom:0.5rem">' +
        '全体健全性スコア: ' + healthScore + '%' +
      '</div>' +
      '<div class="health-bar">' +
        '<div class="health-fill" style="width:' + healthScore + '%;background:' + healthColor + '"></div>' +
      '</div>' +
      '<div style="font-size:0.8rem;color:#888;margin-top:0.3rem">' +
        '全' + totalPairs + 'ペア検査 | 致命的:' + critical + ' 強:' + strong + ' 中:' + moderate + ' 弱:' + weak + ' なし:' + none +
      '</div>' +
    '</div>';

  if (results.length > 0) {
    html += '<div style="font-size:0.85rem;color:#aaa;margin:0.5rem 0">検出された矛盾:</div>';
    results.sort(function(a,b){return b.score-a.score;}).slice(0,10).forEach(function(r) {
      var col = LEVEL_COLORS[r.level];
      html +=
        '<div class="contra-item" style="border-left:3px solid ' + col + '">' +
          '<div style="display:flex;gap:0.5rem;align-items:center">' +
            '<span style="font-size:0.75rem;background:' + col + ';color:#fff;padding:1px 6px;border-radius:3px">' +
              r.level +
            '</span>' +
            '<span style="font-size:0.82rem;color:#ccc">' +
              r.id + '(' + sym[r.dfumtValue] + ') vs ' + r.bId + '(' + sym[r.bVal] + ')' +
            '</span>' +
            '<span style="font-size:0.75rem;color:#666">スコア: ' + r.score + '%</span>' +
          '</div>' +
        '</div>';
    });
  } else {
    html += '<div style="color:#88ccaa;padding:0.5rem">✓ 深刻な矛盾は検出されませんでした</div>';
  }

  document.getElementById('contra-report').innerHTML = html;
}
`;
}
