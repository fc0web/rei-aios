/**
 * Rei-AIOS STEP 10-C — WiktionaryClient
 * Wiktionary API クライアント + AIOSMemoryキャッシュ
 *
 * 完全無料・APIキー不要。
 * 日本語・英語対応。
 * 一度調べた単語はAIOSMemoryにキャッシュ。
 */

import * as https from 'https';
import { AIOSMemory } from '../memory/aios-memory';
import type { DFUMTValue } from '../memory/aios-memory';

export type SearchLang = 'ja' | 'en' | 'auto';

export interface DictionaryEntry {
  word: string;
  lang: string;
  summary: string;           // 短い定義
  extract?: string;          // 詳細定義
  partOfSpeech?: string;    // 品詞
  etymology?: string;        // 語源
  examples?: string[];       // 用例
  relatedWords?: string[];   // 関連語
  wiktionaryUrl: string;     // 出典URL
  dfumtConfidence: DFUMTValue; // 定義の確信度
  fromCache: boolean;        // キャッシュからの取得か
  fetchedAt: string;
}

export interface DictionaryResult {
  success: boolean;
  entry?: DictionaryEntry;
  error?: string;
  latencyMs: number;
}

// ─── HTTPSリクエスト ─────────────────────────────────────────
function fetchUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Rei-AIOS/1.0 (https://github.com/fc0web/rei-aios)',
        'Accept': 'application/json',
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error('タイムアウト（8秒）'));
    });
  });
}

// ─── 言語自動判定 ─────────────────────────────────────────────
export function detectLang(word: string): 'ja' | 'en' {
  // 日本語文字（ひらがな・カタカナ・漢字）が含まれれば日本語
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(word)) return 'ja';
  return 'en';
}

// ─── D-FUMT確信度の評価 ──────────────────────────────────────
export function evalConfidence(summary: string): DFUMTValue {
  if (!summary || summary.length < 10) return 'NEITHER';
  if (summary.includes('曖昧') || summary.includes('複数') ||
      summary.includes('disambiguation')) return 'BOTH';
  if (summary.includes('古語') || summary.includes('方言') ||
      summary.includes('俗語')) return 'FLOWING';
  if (summary.length > 50) return 'TRUE';
  return 'FLOWING';
}

// ─── 品詞の抽出（簡易） ──────────────────────────────────────
function extractPartOfSpeech(text: string): string | undefined {
  const patterns: Record<string, string> = {
    '名詞': '名詞', '動詞': '動詞', '形容詞': '形容詞',
    '副詞': '副詞', '助詞': '助詞', '接続詞': '接続詞',
    'noun': '名詞(noun)', 'verb': '動詞(verb)',
    'adjective': '形容詞(adjective)', 'adverb': '副詞(adverb)',
  };
  for (const [key, val] of Object.entries(patterns)) {
    if (text.toLowerCase().includes(key)) return val;
  }
  return undefined;
}

// ─── WiktionaryClient メインクラス ───────────────────────────
export class WiktionaryClient {
  private memory: AIOSMemory;
  private cacheAgentId = 'wiktionary-cache';

  constructor(cacheDbPath = './dist/dictionary-cache.json') {
    this.memory = new AIOSMemory(cacheDbPath);
  }

  // ── 単語検索メイン ─────────────────────────────────────────
  async lookup(word: string, lang: SearchLang = 'auto'): Promise<DictionaryResult> {
    const start = Date.now();
    const trimmed = word.trim();
    if (!trimmed) {
      return { success: false, error: '単語を入力してください', latencyMs: 0 };
    }

    const resolvedLang = lang === 'auto' ? detectLang(trimmed) : lang;
    const cacheKey = `${resolvedLang}:${trimmed}`;

    // ─ キャッシュ確認 ──────────────────────────────────────
    const cached = this.memory.recall({
      agentId: this.cacheAgentId,
      keyword: cacheKey,
      limit: 1,
    });

    if (cached.length > 0) {
      try {
        const entry = JSON.parse(cached[0].content) as DictionaryEntry;
        entry.fromCache = true;
        return { success: true, entry, latencyMs: Date.now() - start };
      } catch { /* キャッシュ破損 → API再取得 */ }
    }

    // ─ Wiktionary API呼び出し ──────────────────────────────
    try {
      const entry = await this._fetchFromWiktionary(trimmed, resolvedLang);
      entry.fromCache = false;

      // キャッシュに保存
      this.memory.remember(
        this.cacheAgentId,
        'semantic',
        JSON.stringify(entry),
        {
          confidence: entry.dfumtConfidence,
          tags: ['dictionary', resolvedLang, trimmed, cacheKey],
        }
      );

      return { success: true, entry, latencyMs: Date.now() - start };

    } catch (e: any) {
      return {
        success: false,
        error: `取得失敗: ${e.message}`,
        latencyMs: Date.now() - start,
      };
    }
  }

  // ── Wiktionary REST API ────────────────────────────────────
  private async _fetchFromWiktionary(
    word: string,
    lang: 'ja' | 'en'
  ): Promise<DictionaryEntry> {
    const encoded = encodeURIComponent(word);
    const baseUrl = `https://${lang}.wiktionary.org`;

    // REST v1 サマリAPI
    const summaryUrl = `${baseUrl}/api/rest_v1/page/summary/${encoded}`;
    const summaryRaw = await fetchUrl(summaryUrl);
    const summaryJson = JSON.parse(summaryRaw);

    if (summaryJson.type === 'https://mediawiki.org/wiki/HyperSwitch/errors/not_found') {
      throw new Error(`「${word}」は見つかりませんでした`);
    }

    const summary = summaryJson.extract ?? summaryJson.description ?? '';
    const wiktionaryUrl = summaryJson.content_urls?.desktop?.page
      ?? `${baseUrl}/wiki/${encoded}`;

    // MediaWiki API で詳細定義を取得
    let extract = '';
    let examples: string[] = [];
    try {
      const mwUrl = `${baseUrl}/w/api.php?action=query&titles=${encoded}&prop=extracts&exintro=true&format=json&origin=*`;
      const mwRaw = await fetchUrl(mwUrl);
      const mwJson = JSON.parse(mwRaw);
      const pages = mwJson.query?.pages ?? {};
      const page = Object.values(pages)[0] as any;
      if (page?.extract) {
        // HTMLタグを除去
        extract = page.extract
          .replace(/<[^>]+>/g, '')
          .replace(/\n{3,}/g, '\n\n')
          .trim()
          .slice(0, 500);

        // 用例を抽出（「例:」「例文:」パターン）
        const exampleMatches = extract.match(/[例用例]\s*[:：]\s*(.+)/g) ?? [];
        examples = exampleMatches.map(e => e.replace(/^[例用例]\s*[:：]\s*/, '').trim());
      }
    } catch { /* 詳細取得失敗は無視 */ }

    const partOfSpeech = extractPartOfSpeech(extract || summary);
    const dfumtConfidence = evalConfidence(summary);

    return {
      word,
      lang,
      summary: summary.slice(0, 200),
      extract: extract || undefined,
      partOfSpeech,
      examples: examples.length > 0 ? examples : undefined,
      wiktionaryUrl,
      dfumtConfidence,
      fromCache: false,
      fetchedAt: new Date().toISOString(),
    };
  }

  // ── 複数単語の一括検索 ────────────────────────────────────
  async lookupBatch(
    words: string[],
    lang: SearchLang = 'auto'
  ): Promise<DictionaryResult[]> {
    const results: DictionaryResult[] = [];
    for (const word of words) {
      const result = await this.lookup(word, lang);
      results.push(result);
      // APIへの負荷を下げるため少し待機
      if (!result.entry?.fromCache) {
        await new Promise(r => setTimeout(r, 300));
      }
    }
    return results;
  }

  // ── キャッシュ統計 ────────────────────────────────────────
  cacheStats(): { total: number; byLang: Record<string, number> } {
    const entries = this.memory.recall({
      agentId: this.cacheAgentId,
      limit: 10000,
    });

    const byLang: Record<string, number> = {};
    for (const e of entries) {
      const langTag = e.tags.find(t => t === 'ja' || t === 'en') ?? 'unknown';
      byLang[langTag] = (byLang[langTag] ?? 0) + 1;
    }

    return { total: entries.length, byLang };
  }

  // ── キャッシュクリア ──────────────────────────────────────
  clearCache(): number {
    const entries = this.memory.recall({
      agentId: this.cacheAgentId,
      limit: 10000,
    });
    let count = 0;
    for (const e of entries) {
      if (this.memory.forget(e.id)) count++;
    }
    return count;
  }

  get cacheSize(): number {
    return this.memory.size;
  }
}

// ─── WebUIパネル生成 ──────────────────────────────────────────
export function generateDictionaryPanel(): string {
  return `
<!-- ⬡ 辞書パネル -->
<div id="panel-dictionary" class="panel" style="display:none">
  <div class="dict-container">

    <!-- 検索バー -->
    <div class="dict-search-bar">
      <input type="text" id="dict-input"
        class="dict-input"
        placeholder="単語を入力（日本語・英語 自動判定）..."
        onkeydown="if(event.key==='Enter') lookupWord()"/>
      <select id="dict-lang" class="dict-lang-select">
        <option value="auto">自動判定</option>
        <option value="ja">日本語</option>
        <option value="en">英語</option>
      </select>
      <button onclick="lookupWord()" class="btn-dict-search">検索</button>
    </div>

    <!-- 検索履歴 -->
    <div id="dict-history-bar" class="dict-history-bar"></div>

    <!-- 結果表示 -->
    <div id="dict-result" class="dict-result">
      <div class="dict-placeholder">
        単語を入力して検索してください<br>
        <span style="font-size:0.8rem;color:#555">
          Powered by Wiktionary（完全無料・APIキー不要）
        </span>
      </div>
    </div>

    <!-- キャッシュ情報 -->
    <div id="dict-cache-info" class="dict-cache-info">
      <span id="cache-count">キャッシュ: 0件</span>
      <button onclick="clearDictCache()" class="btn-tiny">キャッシュクリア</button>
    </div>
  </div>
</div>

<style>
.dict-container {
  display: flex; flex-direction: column; gap: 0.75rem; height: 100%;
}
.dict-search-bar {
  display: flex; gap: 0.5rem; align-items: center;
}
.dict-input {
  flex: 1; background: var(--surface); color: var(--text);
  border: 1px solid #444; border-radius: 8px;
  padding: 0.5rem 0.75rem; font-size: 1rem;
  font-family: inherit;
}
.dict-lang-select {
  background: var(--surface); color: var(--text);
  border: 1px solid #444; border-radius: 6px;
  padding: 0.4rem 0.5rem; font-size: 0.85rem;
}
.btn-dict-search {
  background: var(--dfumt); color: #fff;
  border: none; border-radius: 8px;
  padding: 0.5rem 1.2rem; cursor: pointer;
  font-size: 0.9rem; white-space: nowrap;
}
.btn-dict-search:hover { opacity: 0.85; }
.dict-history-bar {
  display: flex; gap: 0.4rem; flex-wrap: wrap;
}
.dict-history-chip {
  background: #2a2a3a; color: #aaa;
  border: 1px solid #444; border-radius: 12px;
  padding: 2px 10px; font-size: 0.78rem;
  cursor: pointer;
}
.dict-history-chip:hover { background: #3a3a4a; color: #ddd; }
.dict-result {
  flex: 1; overflow-y: auto;
  background: #111115; border-radius: 10px;
  padding: 1rem; min-height: 300px;
}
.dict-placeholder { color: #555; text-align: center; margin-top: 3rem; line-height: 2; }
.dict-word-header {
  display: flex; align-items: baseline; gap: 0.75rem;
  margin-bottom: 0.75rem; border-bottom: 1px solid #333;
  padding-bottom: 0.5rem;
}
.dict-word-title { font-size: 1.6rem; color: var(--highlight); font-weight: bold; }
.dict-word-lang { font-size: 0.8rem; color: #666; }
.dict-pos { font-size: 0.8rem; color: var(--accent); padding: 2px 8px;
  border: 1px solid var(--accent); border-radius: 4px; }
.dict-dfumt-badge {
  font-size: 0.75rem; padding: 2px 8px;
  border-radius: 4px; color: #fff; font-weight: bold;
}
.dict-cache-badge {
  font-size: 0.7rem; color: #666;
  padding: 1px 6px; border: 1px solid #444; border-radius: 4px;
}
.dict-summary { font-size: 1rem; color: #ccc; line-height: 1.7; margin-bottom: 0.75rem; }
.dict-extract {
  font-size: 0.85rem; color: #999; line-height: 1.6;
  background: #1a1a22; border-radius: 6px; padding: 0.75rem;
  margin-bottom: 0.75rem; white-space: pre-wrap;
}
.dict-examples { margin-bottom: 0.75rem; }
.dict-example-item {
  font-size: 0.85rem; color: #88aacc;
  padding: 0.3rem 0.5rem; border-left: 2px solid var(--accent);
  margin-bottom: 0.3rem;
}
.dict-source {
  font-size: 0.75rem; color: #555;
}
.dict-source a { color: #777; text-decoration: none; }
.dict-source a:hover { color: #aaa; }
.dict-cache-info {
  display: flex; align-items: center; gap: 0.75rem;
  font-size: 0.75rem; color: #555;
}
.btn-tiny {
  background: #2a2a2a; color: #888;
  border: 1px solid #444; border-radius: 4px;
  padding: 2px 8px; cursor: pointer; font-size: 0.72rem;
}
.dict-error {
  color: #cc6666; padding: 1rem; text-align: center;
}
.dict-loading { color: #888; padding: 1rem; text-align: center; }
</style>

<script>
// ─── 辞書機能 ─────────────────────────────────────────────────
var DICT_CACHE_KEY = 'rei_aios_dict_cache';
var DICT_HISTORY_KEY = 'rei_aios_dict_history';

var DICT_DFUMT_COLORS = {
  TRUE:'#88aaff', FALSE:'#666688', BOTH:'#aa88ff',
  NEITHER:'#888888', INFINITY:'#ffaa44', ZERO:'#44aacc', FLOWING:'#88ccaa'
};
var DICT_DFUMT_SYMBOLS = {
  TRUE:'⊤', FALSE:'⊥', BOTH:'B', NEITHER:'N',
  INFINITY:'∞', ZERO:'〇', FLOWING:'～'
};

// ローカルキャッシュ（localStorage）
function getDictCache() {
  try { return JSON.parse(localStorage.getItem(DICT_CACHE_KEY) || '{}'); }
  catch { return {}; }
}
function setDictCache(cache) {
  try { localStorage.setItem(DICT_CACHE_KEY, JSON.stringify(cache)); }
  catch {}
}
function getCachedEntry(word, lang) {
  var cache = getDictCache();
  return cache[lang + ':' + word] || null;
}
function setCachedEntry(word, lang, entry) {
  var cache = getDictCache();
  cache[lang + ':' + word] = entry;
  var keys = Object.keys(cache);
  if (keys.length > 200) delete cache[keys[0]];
  setDictCache(cache);
  updateCacheCount();
}
function updateCacheCount() {
  var count = Object.keys(getDictCache()).length;
  var el = document.getElementById('cache-count');
  if (el) el.textContent = 'キャッシュ: ' + count + '件';
}
function clearDictCache() {
  if (confirm('辞書キャッシュを削除しますか？')) {
    localStorage.removeItem(DICT_CACHE_KEY);
    updateCacheCount();
  }
}

// 検索履歴
function getDictHistory() {
  try { return JSON.parse(localStorage.getItem(DICT_HISTORY_KEY) || '[]'); }
  catch { return []; }
}
function addDictHistory(word) {
  var history = getDictHistory().filter(function(w) { return w !== word; });
  history.unshift(word);
  localStorage.setItem(DICT_HISTORY_KEY, JSON.stringify(history.slice(0, 10)));
  renderDictHistory();
}
function renderDictHistory() {
  var history = getDictHistory();
  var bar = document.getElementById('dict-history-bar');
  if (!bar || history.length === 0) return;
  bar.innerHTML = history.map(function(w) {
    return '<span class="dict-history-chip" onclick="lookupWordDirect(\\'' + escHtml(w) + '\\')">' + escHtml(w) + '</span>';
  }).join('');
}

// 言語自動判定
function detectLangDict(word) {
  return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(word) ? 'ja' : 'en';
}

// D-FUMT確信度評価
function evalDictDFUMT(summary) {
  if (!summary || summary.length < 10) return 'NEITHER';
  if (summary.indexOf('曖昧') >= 0 || summary.indexOf('disambiguation') >= 0) return 'BOTH';
  if (summary.indexOf('古語') >= 0 || summary.indexOf('方言') >= 0) return 'FLOWING';
  if (summary.length > 50) return 'TRUE';
  return 'FLOWING';
}

// メイン検索関数
async function lookupWord() {
  var input = document.getElementById('dict-input');
  var word = input.value.trim();
  if (!word) return;
  await lookupWordDirect(word);
}

async function lookupWordDirect(word) {
  document.getElementById('dict-input').value = word;
  var langSelect = document.getElementById('dict-lang').value;
  var lang = langSelect === 'auto' ? detectLangDict(word) : langSelect;
  var result = document.getElementById('dict-result');

  // キャッシュ確認
  var cached = getCachedEntry(word, lang);
  if (cached) {
    cached.fromCache = true;
    renderDictResult(cached);
    addDictHistory(word);
    return;
  }

  // ローディング表示
  result.innerHTML = '<div class="dict-loading">⏳ Wiktionaryを検索中...</div>';

  try {
    var encoded = encodeURIComponent(word);
    var baseUrl = 'https://' + lang + '.wiktionary.org';

    // REST API サマリ
    var res = await fetch(
      baseUrl + '/api/rest_v1/page/summary/' + encoded,
      { headers: { 'Accept': 'application/json' } }
    );
    var data = await res.json();

    if (data.type && data.type.indexOf('not_found') >= 0) {
      result.innerHTML = '<div class="dict-error">' +
        '「' + escHtml(word) + '」は見つかりませんでした<br>' +
        '<span style="font-size:0.8rem;color:#666">' +
        'スペルを確認するか、別の言語で試してください</span></div>';
      return;
    }

    // MediaWiki API で詳細取得
    var extract = '';
    try {
      var mwRes = await fetch(
        baseUrl + '/w/api.php?action=query&titles=' + encoded + '&prop=extracts&exintro=true&format=json&origin=*'
      );
      var mwData = await mwRes.json();
      var pages = mwData.query ? mwData.query.pages : {};
      var page = Object.values(pages)[0];
      if (page && page.extract) {
        extract = page.extract
          .replace(/<[^>]+>/g, '')
          .replace(/\\n{3,}/g, '\\n\\n')
          .trim()
          .slice(0, 500);
      }
    } catch(e2) {}

    var summary = data.extract || data.description || '';
    var dfumt = evalDictDFUMT(summary);
    var entry = {
      word: word,
      lang: lang,
      summary: summary.slice(0, 200),
      extract: extract || undefined,
      wiktionaryUrl: (data.content_urls && data.content_urls.desktop ? data.content_urls.desktop.page : null) || (baseUrl + '/wiki/' + encoded),
      dfumtConfidence: dfumt,
      fromCache: false,
      fetchedAt: new Date().toISOString(),
    };

    setCachedEntry(word, lang, entry);
    renderDictResult(entry);
    addDictHistory(word);

  } catch (e) {
    result.innerHTML = '<div class="dict-error">' +
      'エラー: ' + escHtml(e.message) + '<br>' +
      '<span style="font-size:0.8rem;color:#666">ネットワーク接続を確認してください</span></div>';
  }
}

function renderDictResult(entry) {
  var result = document.getElementById('dict-result');
  var dfumt = entry.dfumtConfidence || 'TRUE';
  var dfumtColor = DICT_DFUMT_COLORS[dfumt] || '#666';
  var dfumtSym = DICT_DFUMT_SYMBOLS[dfumt] || '?';
  var langLabel = entry.lang === 'ja' ? '日本語' : 'English';

  var html = '<div class="dict-word-header">' +
    '<span class="dict-word-title">' + escHtml(entry.word) + '</span>' +
    '<span class="dict-word-lang">' + langLabel + '</span>' +
    '<span class="dict-dfumt-badge" style="background:' + dfumtColor + '">' +
    dfumtSym + ' ' + dfumt + '</span>' +
    (entry.fromCache
      ? '<span class="dict-cache-badge">⚡ キャッシュ</span>'
      : '<span class="dict-cache-badge">🌐 Wiktionary</span>') +
    '</div>';

  if (entry.summary) {
    html += '<div class="dict-summary">' + escHtml(entry.summary) + '</div>';
  }

  if (entry.extract && entry.extract !== entry.summary) {
    html += '<div class="dict-extract">' + escHtml(entry.extract.slice(0, 400)) + '</div>';
  }

  html += '<div class="dict-source">' +
    '出典: <a href="' + entry.wiktionaryUrl + '" target="_blank">' +
    'Wiktionary — ' + escHtml(entry.word) + '</a>' +
    (entry.fromCache ? '' :
      '<span style="margin-left:0.5rem;color:#444">' +
      '取得: ' + new Date(entry.fetchedAt).toLocaleString('ja-JP') + '</span>') +
    '</div>';

  result.innerHTML = html;
}

// 初期化
document.addEventListener('DOMContentLoaded', function() {
  updateCacheCount();
  renderDictHistory();
});
</script>
`;
}
