/**
 * Rei-AIOS STEP 13-E — ConfidenceTracker
 * 公理の確信度を時系列でトラッキングする
 *
 * LLMにはできない「知識の成長記録」を実現。
 * 公理が不確かな状態から確定的な真理へ育つ過程を記録。
 */

import { AIOSMemory } from '../memory/aios-memory';
import { DFUMTCalculator } from '../logic/dfumt-calculator';
import type { DFUMTValue } from '../memory/aios-memory';

// ─── 型定義 ──────────────────────────────────────────────────
export interface ConfidenceEvent {
  id: string;                  // イベントID
  axiomId: string;             // Theory IDなど
  timestamp: string;           // ISO形式
  previousValue: DFUMTValue;
  newValue: DFUMTValue;
  previousScore: number;       // 0〜100
  newScore: number;            // 0〜100
  trigger: ConfidenceTrigger;  // 何が確信度を変えたか
  note: string;                // メモ
}

export type ConfidenceTrigger =
  | 'REGISTRATION'     // 初回登録
  | 'CONSISTENCY_CHECK'// 整合性確認
  | 'CONTRADICTION_RESOLVED' // 矛盾解消
  | 'PEER_VERIFICATION'// 他者による検証
  | 'REI_PL_PROOF'     // Rei-PLで証明
  | 'NOSTR_CONFIRMED'  // Nostrネットワークで確認
  | 'MANUAL_UPDATE'    // 手動更新
  | 'DECAY';           // 時間経過による減衰

export interface AxiomConfidence {
  axiomId: string;
  name: string;
  currentValue: DFUMTValue;
  currentScore: number;        // 0〜100
  peakScore: number;           // 最高スコア
  history: ConfidenceEvent[];
  verificationCount: number;   // 検証回数
  createdAt: string;
  lastUpdatedAt: string;
  status: 'GROWING' | 'STABLE' | 'DECLINING' | 'PROVEN';
}

// ─── 確信度スコアとD-FUMT値の対応 ───────────────────────────
function scoreToDFUMT(score: number): DFUMTValue {
  if (score >= 90) return 'TRUE';
  if (score >= 70) return 'BOTH';
  if (score >= 50) return 'FLOWING';
  if (score >= 15) return 'NEITHER';
  if (score >= 5)  return 'FALSE';
  return 'ZERO';
}

function triggerToScoreDelta(trigger: ConfidenceTrigger): number {
  const deltas: Record<ConfidenceTrigger, number> = {
    REGISTRATION:          0,
    CONSISTENCY_CHECK:     +12,
    CONTRADICTION_RESOLVED:+18,
    PEER_VERIFICATION:     +15,
    REI_PL_PROOF:          +25,
    NOSTR_CONFIRMED:       +10,
    MANUAL_UPDATE:         0,
    DECAY:                 -5,
  };
  return deltas[trigger] ?? 0;
}

// ─── ConfidenceTracker メインクラス ──────────────────────────
export class ConfidenceTracker {
  private memory: AIOSMemory;
  private calc: DFUMTCalculator;
  private cache: Map<string, AxiomConfidence> = new Map();
  private agentId = 'confidence-tracker';

  constructor(dbPath = './dist/confidence-db.json') {
    this.memory = new AIOSMemory(dbPath);
    this.calc = new DFUMTCalculator();
  }

  // ── 公理の新規登録 ────────────────────────────────────────
  register(
    axiomId: string,
    name: string,
    initialScore = 20,
    note = '初回登録'
  ): AxiomConfidence {
    const initialValue = scoreToDFUMT(initialScore);

    const initEvent: ConfidenceEvent = {
      id: `${axiomId}-${Date.now()}`,
      axiomId,
      timestamp: new Date().toISOString(),
      previousValue: 'ZERO',
      newValue: initialValue,
      previousScore: 0,
      newScore: initialScore,
      trigger: 'REGISTRATION',
      note,
    };

    const confidence: AxiomConfidence = {
      axiomId,
      name,
      currentValue: initialValue,
      currentScore: initialScore,
      peakScore: initialScore,
      history: [initEvent],
      verificationCount: 0,
      createdAt: initEvent.timestamp,
      lastUpdatedAt: initEvent.timestamp,
      status: 'GROWING',
    };

    this._save(confidence);
    return confidence;
  }

  // ── 確信度の更新（イベント記録） ─────────────────────────
  update(
    axiomId: string,
    trigger: ConfidenceTrigger,
    note = '',
    manualScore?: number
  ): AxiomConfidence | null {
    const confidence = this._load(axiomId);
    if (!confidence) return null;

    const prevScore = confidence.currentScore;
    const prevValue = confidence.currentValue;

    let newScore: number;
    if (trigger === 'MANUAL_UPDATE' && manualScore !== undefined) {
      newScore = Math.max(0, Math.min(100, manualScore));
    } else {
      const delta = triggerToScoreDelta(trigger);
      newScore = Math.max(0, Math.min(100, prevScore + delta));
    }

    const newValue = scoreToDFUMT(newScore);

    const event: ConfidenceEvent = {
      id: `${axiomId}-${Date.now()}`,
      axiomId,
      timestamp: new Date().toISOString(),
      previousValue: prevValue,
      newValue,
      previousScore: prevScore,
      newScore,
      trigger,
      note,
    };

    confidence.history.push(event);
    confidence.currentScore = newScore;
    confidence.currentValue = newValue;
    confidence.lastUpdatedAt = event.timestamp;
    confidence.peakScore = Math.max(confidence.peakScore, newScore);
    confidence.verificationCount += trigger !== 'DECAY' ? 1 : 0;

    if (newScore >= 90) confidence.status = 'PROVEN';
    else if (newScore > prevScore) confidence.status = 'GROWING';
    else if (newScore < prevScore) confidence.status = 'DECLINING';
    else confidence.status = 'STABLE';

    this._save(confidence);
    return confidence;
  }

  // ── 公理の取得 ────────────────────────────────────────────
  get(axiomId: string): AxiomConfidence | null {
    return this._load(axiomId);
  }

  // ── 全公理一覧 ────────────────────────────────────────────
  listAll(): AxiomConfidence[] {
    return Array.from(this.cache.values());
  }

  // ── 確信度ランキング ─────────────────────────────────────
  ranking(top = 10): AxiomConfidence[] {
    return this.listAll()
      .sort((a, b) => b.currentScore - a.currentScore)
      .slice(0, top);
  }

  // ── 統計 ────────────────────────────────────────────────
  stats(): {
    total: number;
    proven: number;
    growing: number;
    stable: number;
    declining: number;
    averageScore: number;
    byDFUMT: Record<DFUMTValue, number>;
  } {
    const all = this.listAll();
    const byDFUMT: Record<string, number> = {};
    let sumScore = 0;

    for (const c of all) {
      byDFUMT[c.currentValue] = (byDFUMT[c.currentValue] ?? 0) + 1;
      sumScore += c.currentScore;
    }

    return {
      total: all.length,
      proven: all.filter(c => c.status === 'PROVEN').length,
      growing: all.filter(c => c.status === 'GROWING').length,
      stable: all.filter(c => c.status === 'STABLE').length,
      declining: all.filter(c => c.status === 'DECLINING').length,
      averageScore: all.length > 0 ? Math.round(sumScore / all.length) : 0,
      byDFUMT: byDFUMT as Record<DFUMTValue, number>,
    };
  }

  // ── 時間経過による自動減衰（定期実行想定） ────────────────
  applyDecay(daysThreshold = 30): number {
    const all = this.listAll();
    let decayed = 0;
    const now = Date.now();

    for (const c of all) {
      const lastUpdate = new Date(c.lastUpdatedAt).getTime();
      const daysSince = (now - lastUpdate) / (1000 * 60 * 60 * 24);
      if (daysSince > daysThreshold && c.currentScore > 30) {
        this.update(c.axiomId, 'DECAY', `${Math.round(daysSince)}日間未検証`);
        decayed++;
      }
    }
    return decayed;
  }

  // ── 内部: 保存 ───────────────────────────────────────────
  private _save(confidence: AxiomConfidence): void {
    this.cache.set(confidence.axiomId, confidence);
    this.memory.remember(
      this.agentId,
      'semantic',
      JSON.stringify(confidence),
      {
        confidence: confidence.currentValue,
        tags: [
          'axiom-confidence',
          confidence.axiomId,
          confidence.currentValue,
          confidence.status,
        ],
      }
    );
  }

  // ── 内部: 読み込み ────────────────────────────────────────
  private _load(axiomId: string): AxiomConfidence | null {
    const cached = this.cache.get(axiomId);
    if (cached) return cached;
    const entries = this.memory.recall({
      agentId: this.agentId,
      keyword: axiomId,
      limit: 10,
    });
    if (entries.length === 0) return null;
    // Return the most recent entry (last saved)
    for (let i = entries.length - 1; i >= 0; i--) {
      try {
        const parsed = JSON.parse(entries[i].content) as AxiomConfidence;
        if (parsed.axiomId === axiomId) {
          this.cache.set(axiomId, parsed);
          return parsed;
        }
      } catch { /* skip */ }
    }
    return null;
  }

  get size(): number { return this.memory.size; }
}

// ─── WebUIパネル生成 ──────────────────────────────────────────
export function generateConfidencePanel(): string {
  return `
<!-- ⬡ 確信度トラッキングパネル -->
<div id="panel-confidence" class="panel" style="display:none">
  <div class="conf-container">

    <!-- ヘッダー -->
    <div class="conf-header">
      <div class="conf-title">知識の確信度トラッキング</div>
      <div class="conf-subtitle">
        公理が不確かな状態から真理へ「育っていく」過程を記録
      </div>
    </div>

    <!-- 新規登録 -->
    <div class="conf-section">
      <div class="conf-section-title">＋ 公理を登録</div>
      <div class="conf-register-row">
        <input type="text" id="conf-axiom-id"
          placeholder="Theory ID（例: Theory #101）"
          class="conf-input"/>
        <input type="text" id="conf-axiom-name"
          placeholder="公理名（例: 意識の自己参照公理）"
          class="conf-input conf-name-input"/>
        <input type="number" id="conf-init-score"
          placeholder="初期確信度（0〜100）" value="20"
          min="0" max="100" class="conf-input conf-score-input"/>
        <button onclick="registerAxiomConf()" class="btn-nostr-primary">登録</button>
      </div>
      <div id="conf-register-result" class="conf-result-msg"></div>
    </div>

    <!-- 確信度更新 -->
    <div class="conf-section">
      <div class="conf-section-title">確信度を更新</div>
      <div class="conf-update-row">
        <input type="text" id="conf-update-id"
          placeholder="Theory ID" class="conf-input"/>
        <select id="conf-trigger" class="calc-select">
          <option value="CONSISTENCY_CHECK">整合性確認 (+12%)</option>
          <option value="CONTRADICTION_RESOLVED">矛盾解消 (+18%)</option>
          <option value="PEER_VERIFICATION">他者検証 (+15%)</option>
          <option value="REI_PL_PROOF">Rei-PL証明 (+25%)</option>
          <option value="NOSTR_CONFIRMED">Nostr確認 (+10%)</option>
          <option value="MANUAL_UPDATE">手動更新</option>
          <option value="DECAY">減衰 (-5%)</option>
        </select>
        <input type="text" id="conf-update-note"
          placeholder="メモ" class="conf-input"/>
        <button onclick="updateAxiomConf()" class="btn-nostr-primary">更新</button>
      </div>
      <div id="conf-update-result" class="conf-result-msg"></div>
    </div>

    <!-- 確信度タイムライン -->
    <div class="conf-section">
      <div class="conf-section-title">確信度タイムライン</div>
      <div class="conf-lookup-row">
        <input type="text" id="conf-lookup-id"
          placeholder="Theory IDを入力" class="conf-input"/>
        <button onclick="lookupConfidence()" class="btn-nostr">詳細表示</button>
      </div>
      <div id="conf-timeline" class="conf-timeline"></div>
    </div>

    <!-- 全体ランキング -->
    <div class="conf-section">
      <div class="conf-section-title">確信度ランキング</div>
      <button onclick="renderConfRanking()" class="btn-nostr">ランキング更新</button>
      <div id="conf-ranking" class="conf-ranking"></div>
    </div>

    <!-- 統計 -->
    <div class="conf-section">
      <div class="conf-section-title">全体統計</div>
      <button onclick="renderConfStats()" class="btn-nostr" style="margin-bottom:0.5rem">統計更新</button>
      <div id="conf-stats" class="conf-stats"></div>
      <!-- ステータス定義: GROWING / STABLE / DECLINING / PROVEN -->
    </div>
  </div>
</div>

<style>
.conf-container { display: flex; flex-direction: column; gap: 0.75rem; }
.conf-header { border-bottom: 1px solid #333; padding-bottom: 0.5rem; }
.conf-title { font-size: 0.95rem; color: var(--highlight); }
.conf-subtitle { font-size: 0.72rem; color: #555; }
.conf-section { background: #111115; border-radius: 10px; padding: 0.75rem; }
.conf-section-title { font-size: 0.85rem; color: #aaa; margin-bottom: 0.5rem; }
.conf-register-row, .conf-update-row, .conf-lookup-row {
  display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center;
}
.conf-input {
  background: var(--surface); color: var(--text);
  border: 1px solid #444; border-radius: 6px;
  padding: 0.4rem 0.6rem; font-size: 0.85rem; flex: 1; min-width: 120px;
}
.conf-name-input { flex: 2; }
.conf-score-input { flex: 0; min-width: 80px; max-width: 100px; }
.conf-result-msg { font-size: 0.82rem; color: #88ccaa; margin-top: 0.3rem; min-height: 1.2rem; }
.conf-timeline { margin-top: 0.5rem; }
.conf-timeline-item {
  display: flex; gap: 0.5rem; align-items: center;
  padding: 0.4rem 0; border-bottom: 1px solid #222;
  font-size: 0.82rem;
}
.conf-tl-score {
  font-weight: bold; min-width: 40px; text-align: right;
}
.conf-tl-bar {
  flex: 1; height: 8px; background: #222; border-radius: 4px; overflow: hidden;
}
.conf-tl-fill { height: 100%; border-radius: 4px; transition: width 0.4s; }
.conf-tl-trigger { color: #666; font-size: 0.75rem; white-space: nowrap; }
.conf-tl-note { color: #555; font-size: 0.72rem; }
.conf-ranking { margin-top: 0.5rem; }
.conf-ranking-item {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.35rem 0; border-bottom: 1px solid #1a1a22;
  font-size: 0.82rem;
}
.conf-rank-num { color: #555; min-width: 20px; text-align: right; }
.conf-rank-id { color: #aaa; flex: 1; }
.conf-rank-bar { width: 80px; height: 6px; background: #222; border-radius: 3px; overflow: hidden; }
.conf-rank-fill { height: 100%; border-radius: 3px; }
.conf-rank-score { color: #888; min-width: 35px; text-align: right; }
.conf-stats { display: flex; flex-wrap: wrap; gap: 0.75rem; font-size: 0.82rem; }
.conf-stat-item { background: #1a1a22; border-radius: 8px; padding: 0.5rem 0.75rem; }
.conf-stat-val { font-size: 1.1rem; font-weight: bold; color: var(--highlight); }
.conf-stat-label { font-size: 0.72rem; color: #666; }
.conf-dfumt-badge {
  font-size: 0.72rem; padding: 1px 6px; border-radius: 3px;
  color: #fff; font-weight: bold; white-space: nowrap;
}
.conf-status-badge {
  font-size: 0.7rem; padding: 1px 5px; border-radius: 3px; color: #fff;
}
</style>
`;
}

// ─── WebUIスクリプト生成 ──────────────────────────────────────
export function generateConfidenceScript(): string {
  return `
// ─── STEP 13-E: 確信度トラッキング UI ───────────────────────
const CONF_STORAGE_KEY = 'rei_aios_confidence';
const DFUMT_COLORS_CONF = {
  TRUE:'#88aaff', FALSE:'#cc6677', BOTH:'#aa88ff',
  NEITHER:'#888888', INFINITY:'#ffaa44', ZERO:'#44aacc', FLOWING:'#88ccaa'
};
const DFUMT_SYMBOLS_CONF = {
  TRUE:'⊤', FALSE:'⊥', BOTH:'B', NEITHER:'N',
  INFINITY:'∞', ZERO:'〇', FLOWING:'～'
};
const STATUS_COLORS = {
  PROVEN:'#88aaff', GROWING:'#88ccaa', STABLE:'#888888', DECLINING:'#cc6677'
};
const STATUS_LABELS = {
  PROVEN:'✓ 証明済', GROWING:'↑ 成長中', STABLE:'→ 安定', DECLINING:'↓ 低下中'
};
const TRIGGER_LABELS = {
  REGISTRATION:'初回登録', CONSISTENCY_CHECK:'整合性確認',
  CONTRADICTION_RESOLVED:'矛盾解消', PEER_VERIFICATION:'他者検証',
  REI_PL_PROOF:'Rei-PL証明', NOSTR_CONFIRMED:'Nostr確認',
  MANUAL_UPDATE:'手動更新', DECAY:'時間減衰',
};
const TRIGGER_DELTAS = {
  REGISTRATION:0, CONSISTENCY_CHECK:12, CONTRADICTION_RESOLVED:18,
  PEER_VERIFICATION:15, REI_PL_PROOF:25, NOSTR_CONFIRMED:10,
  MANUAL_UPDATE:0, DECAY:-5,
};

function confScoreToDFUMT(score) {
  if (score >= 90) return 'TRUE';
  if (score >= 70) return 'BOTH';
  if (score >= 50) return 'FLOWING';
  if (score >= 15) return 'NEITHER';
  if (score >= 5)  return 'FALSE';
  return 'ZERO';
}

function getConfDB() {
  try { return JSON.parse(localStorage.getItem(CONF_STORAGE_KEY) || '{}'); }
  catch { return {}; }
}
function setConfDB(db) {
  try { localStorage.setItem(CONF_STORAGE_KEY, JSON.stringify(db)); }
  catch {}
}

function registerAxiomConf() {
  var id = document.getElementById('conf-axiom-id').value.trim();
  var name = document.getElementById('conf-axiom-name').value.trim();
  var score = parseInt(document.getElementById('conf-init-score').value) || 20;

  if (!id || !name) {
    document.getElementById('conf-register-result').innerHTML =
      '<span style="color:#cc6677">IDと名前を入力してください</span>';
    return;
  }

  var db = getConfDB();
  var initVal = confScoreToDFUMT(score);
  var now = new Date().toISOString();
  var initEvent = {
    id: id + '-' + Date.now(), axiomId: id,
    timestamp: now, previousValue: 'ZERO', newValue: initVal,
    previousScore: 0, newScore: score,
    trigger: 'REGISTRATION', note: '初回登録',
  };

  db[id] = {
    axiomId: id, name: name, currentValue: initVal, currentScore: score,
    peakScore: score, history: [initEvent], verificationCount: 0,
    createdAt: now, lastUpdatedAt: now, status: 'GROWING',
  };
  setConfDB(db);

  var col = DFUMT_COLORS_CONF[initVal];
  var sym = DFUMT_SYMBOLS_CONF[initVal];
  document.getElementById('conf-register-result').innerHTML =
    '✅ <strong>' + escHtml(id) + '</strong> を登録しました。初期確信度: ' + score +
    '% (<span style="color:' + col + '">' + sym + ' ' + initVal + '</span>)';
  renderConfStats();
}

function updateAxiomConf() {
  var id = document.getElementById('conf-update-id').value.trim();
  var trigger = document.getElementById('conf-trigger').value;
  var note = document.getElementById('conf-update-note').value.trim();

  if (!id) {
    document.getElementById('conf-update-result').innerHTML =
      '<span style="color:#cc6677">Theory IDを入力してください</span>';
    return;
  }

  var db = getConfDB();
  if (!db[id]) {
    document.getElementById('conf-update-result').innerHTML =
      '<span style="color:#cc6677">' + escHtml(id) + ' が見つかりません。先に登録してください</span>';
    return;
  }

  var conf = db[id];
  var prevScore = conf.currentScore;
  var delta = TRIGGER_DELTAS[trigger] || 0;
  var newScore = Math.max(0, Math.min(100, prevScore + delta));
  var newVal = confScoreToDFUMT(newScore);
  var now = new Date().toISOString();

  var event = {
    id: id + '-' + Date.now(), axiomId: id, timestamp: now,
    previousValue: conf.currentValue, newValue: newVal,
    previousScore: prevScore, newScore: newScore,
    trigger: trigger, note: note || TRIGGER_LABELS[trigger],
  };

  conf.history.push(event);
  conf.currentScore = newScore;
  conf.currentValue = newVal;
  conf.lastUpdatedAt = now;
  conf.peakScore = Math.max(conf.peakScore, newScore);
  if (trigger !== 'DECAY') conf.verificationCount++;

  if (newScore >= 90) conf.status = 'PROVEN';
  else if (newScore > prevScore) conf.status = 'GROWING';
  else if (newScore < prevScore) conf.status = 'DECLINING';
  else conf.status = 'STABLE';

  db[id] = conf;
  setConfDB(db);

  var col = DFUMT_COLORS_CONF[newVal];
  var sym = DFUMT_SYMBOLS_CONF[newVal];
  var arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
  document.getElementById('conf-update-result').innerHTML =
    '✅ 更新: ' + prevScore + '% ' + arrow + ' <strong>' + newScore + '%</strong>' +
    ' (<span style="color:' + col + '">' + sym + ' ' + newVal + '</span>)' +
    ' |' + STATUS_LABELS[conf.status];
  renderConfStats();
}

function lookupConfidence() {
  var id = document.getElementById('conf-lookup-id').value.trim();
  var db = getConfDB();
  var conf = db[id];
  var container = document.getElementById('conf-timeline');

  if (!conf) {
    container.innerHTML = '<div style="color:#666">「' + escHtml(id) + '」が見つかりません</div>';
    return;
  }

  var col = DFUMT_COLORS_CONF[conf.currentValue];
  var sym = DFUMT_SYMBOLS_CONF[conf.currentValue];
  var statusCol = STATUS_COLORS[conf.status] || '#888';

  var html =
    '<div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.75rem;flex-wrap:wrap">' +
      '<span style="font-size:1rem;color:#ccc;font-weight:bold">' + escHtml(conf.name) + '</span>' +
      '<span class="conf-dfumt-badge" style="background:' + col + '">' + sym + ' ' + conf.currentValue + '</span>' +
      '<span class="conf-status-badge" style="background:' + statusCol + '">' + STATUS_LABELS[conf.status] + '</span>' +
      '<span style="font-size:0.8rem;color:#888">確信度: ' + conf.currentScore + '%</span>' +
      '<span style="font-size:0.72rem;color:#555">検証回数: ' + conf.verificationCount + '回</span>' +
    '</div>' +
    '<div style="font-size:0.8rem;color:#555;margin-bottom:0.5rem">タイムライン（新しい順）:</div>';

  var history = conf.history.slice().reverse();
  for (var k = 0; k < history.length; k++) {
    var ev = history[k];
    var evCol = DFUMT_COLORS_CONF[ev.newValue];
    var d = ev.newScore - ev.previousScore;
    var deltaStr = d > 0 ? '+' + d : d < 0 ? '' + d : '±0';
    var deltaCol = d > 0 ? '#88ccaa' : d < 0 ? '#cc6677' : '#888';
    var date = new Date(ev.timestamp).toLocaleString('ja-JP', {
      month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'
    });

    html +=
      '<div class="conf-timeline-item">' +
        '<span class="conf-tl-score" style="color:' + evCol + '">' + ev.newScore + '%</span>' +
        '<div class="conf-tl-bar"><div class="conf-tl-fill" style="width:' + ev.newScore + '%;background:' + evCol + '"></div></div>' +
        '<span style="color:' + deltaCol + ';font-size:0.75rem;min-width:30px">' + deltaStr + '</span>' +
        '<span class="conf-dfumt-badge" style="background:' + evCol + ';font-size:0.65rem">' + DFUMT_SYMBOLS_CONF[ev.newValue] + '</span>' +
        '<span class="conf-tl-trigger">' + (TRIGGER_LABELS[ev.trigger] || ev.trigger) + '</span>' +
        '<span class="conf-tl-note">' + escHtml(ev.note || '') + '</span>' +
        '<span style="font-size:0.68rem;color:#444">' + date + '</span>' +
      '</div>';
  }

  container.innerHTML = html;
}

function renderConfRanking() {
  var db = getConfDB();
  var all = Object.values(db).sort(function(a, b) { return b.currentScore - a.currentScore; });
  var container = document.getElementById('conf-ranking');

  if (all.length === 0) {
    container.innerHTML = '<div style="color:#555">まだ公理が登録されていません</div>';
    return;
  }

  container.innerHTML = all.slice(0, 20).map(function(conf, i) {
    var col = DFUMT_COLORS_CONF[conf.currentValue];
    var sym = DFUMT_SYMBOLS_CONF[conf.currentValue];
    var statusCol = STATUS_COLORS[conf.status] || '#888';
    return '<div class="conf-ranking-item">' +
      '<span class="conf-rank-num">' + (i + 1) + '</span>' +
      '<span class="conf-rank-id">' + escHtml(conf.axiomId) + '</span>' +
      '<span style="font-size:0.78rem;color:#888;flex:1">' + escHtml(conf.name.slice(0,15)) + '</span>' +
      '<span class="conf-dfumt-badge" style="background:' + col + '">' + sym + '</span>' +
      '<div class="conf-rank-bar"><div class="conf-rank-fill" style="width:' + conf.currentScore + '%;background:' + col + '"></div></div>' +
      '<span class="conf-rank-score">' + conf.currentScore + '%</span>' +
      '<span class="conf-status-badge" style="background:' + statusCol + ';font-size:0.65rem">' + STATUS_LABELS[conf.status] + '</span>' +
    '</div>';
  }).join('');
}

function renderConfStats() {
  var db = getConfDB();
  var all = Object.values(db);
  if (all.length === 0) {
    document.getElementById('conf-stats').innerHTML =
      '<div style="color:#555">まだ公理が登録されていません</div>';
    return;
  }

  var proven  = all.filter(function(c) { return c.status === 'PROVEN'; }).length;
  var growing = all.filter(function(c) { return c.status === 'GROWING'; }).length;
  var avg = Math.round(all.reduce(function(s, c) { return s + c.currentScore; }, 0) / all.length);

  var byDFUMT = {};
  all.forEach(function(c) { byDFUMT[c.currentValue] = (byDFUMT[c.currentValue] || 0) + 1; });

  var dfumtHtml = Object.keys(byDFUMT).map(function(v) {
    return '<div class="conf-stat-item">' +
      '<div class="conf-stat-val" style="color:' + DFUMT_COLORS_CONF[v] + '">' +
        DFUMT_SYMBOLS_CONF[v] + ' ' + byDFUMT[v] +
      '</div>' +
      '<div class="conf-stat-label">' + v + '</div>' +
    '</div>';
  }).join('');

  document.getElementById('conf-stats').innerHTML =
    '<div class="conf-stat-item"><div class="conf-stat-val">' + all.length + '</div><div class="conf-stat-label">登録公理数</div></div>' +
    '<div class="conf-stat-item"><div class="conf-stat-val" style="color:#88aaff">' + proven + '</div><div class="conf-stat-label">証明済み(TRUE)</div></div>' +
    '<div class="conf-stat-item"><div class="conf-stat-val" style="color:#88ccaa">' + growing + '</div><div class="conf-stat-label">成長中</div></div>' +
    '<div class="conf-stat-item"><div class="conf-stat-val" style="color:var(--highlight)">' + avg + '%</div><div class="conf-stat-label">平均確信度</div></div>' +
    dfumtHtml;
}

document.addEventListener('DOMContentLoaded', function() {
  renderConfStats();
  renderConfRanking();
});
`;
}
