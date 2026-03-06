/**
 * Rei-AIOS STEP 7-A — Axiom OS WebUI
 * 歴史人物チャット・公理ブラウザ・圧縮ベンチマーク・汎用チャットを
 * 一枚のHTMLファイルとして生成するジェネレータ。
 *
 * ibushi-gin（渋銀）デザイン哲学: 暗めのシルバー基調・最小限のUI
 */

import { generateUniversalChatPanel, DEFAULT_PROVIDERS } from '../chat/universal-chat';
import { generateMemoryIntegrationScript } from '../chat/chat-memory-bridge';
import { generateDictionaryPanel } from '../dictionary/wiktionary-client';
import { PERSONAS as HISTORICAL_PERSONAS } from '../chat/persona-chat-engine';
import { generateNostrPanel, DEFAULT_RELAYS } from '../p2p/nostr-axiom-share';

// ─── WebUI HTML生成 ────────────────────────────────────────────
export function generateAxiomOsWebUI(options: WebUIOptions = {}): string {
  const personas = options.personas ?? DEFAULT_PERSONAS;
  const theories = options.theories ?? DEFAULT_THEORIES;
  const universalChatPanel = generateUniversalChatPanel(DEFAULT_PROVIDERS);
  const memoryScript = generateMemoryIntegrationScript();
  const dictionaryPanel = generateDictionaryPanel();
  const nostrPanel = generateNostrPanel(DEFAULT_RELAYS);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Axiom OS — D-FUMT理論研究基盤</title>
  <style>
    /* ibushi-gin（渋銀）デザイン */
    :root {
      --bg:        #1a1a1e;
      --surface:   #26262c;
      --border:    #3a3a42;
      --accent:    #8888aa;
      --text:      #c8c8d0;
      --text-dim:  #666680;
      --highlight: #aa88ff;
      --dfumt:     #88aacc;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--text); font-family: 'Noto Sans JP', monospace; }

    /* ヘッダー */
    header {
      padding: 12px 24px;
      border-bottom: 1px solid var(--border);
      display: flex; align-items: center; gap: 16px;
    }
    header h1 { font-size: 16px; color: var(--accent); letter-spacing: 2px; }
    header span { font-size: 11px; color: var(--text-dim); }

    /* タブナビゲーション */
    nav { display: flex; border-bottom: 1px solid var(--border); }
    nav button {
      padding: 10px 20px; background: none; border: none;
      color: var(--text-dim); cursor: pointer; font-size: 13px;
      border-bottom: 2px solid transparent;
    }
    nav button.active { color: var(--highlight); border-bottom-color: var(--highlight); }

    /* パネル */
    .panel { display: none; padding: 24px; }
    .panel.active { display: block; }

    /* 歴史人物グリッド */
    .persona-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 12px; margin-bottom: 24px;
    }
    .persona-card {
      padding: 14px; background: var(--surface);
      border: 1px solid var(--border); border-radius: 6px;
      cursor: pointer; transition: border-color 0.2s;
    }
    .persona-card:hover { border-color: var(--accent); }
    .persona-card.selected { border-color: var(--highlight); }
    .persona-card .name { font-size: 14px; margin-bottom: 4px; }
    .persona-card .era  { font-size: 11px; color: var(--text-dim); }

    /* チャット */
    .chat-area {
      height: 320px; overflow-y: auto;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 6px; padding: 16px; margin-bottom: 12px;
    }
    .msg { margin-bottom: 12px; }
    .msg .role { font-size: 11px; color: var(--text-dim); margin-bottom: 4px; }
    .msg .content { font-size: 13px; line-height: 1.7; }
    .msg.assistant .content { color: var(--dfumt); }
    .chat-input { display: flex; gap: 8px; }
    .chat-input input {
      flex: 1; padding: 8px 12px; background: var(--surface);
      border: 1px solid var(--border); border-radius: 4px;
      color: var(--text); font-size: 13px;
    }
    .chat-input button {
      padding: 8px 16px; background: var(--accent);
      border: none; border-radius: 4px; color: white; cursor: pointer;
    }

    /* 公理ブラウザ */
    .theory-list { display: flex; flex-direction: column; gap: 8px; }
    .theory-item {
      padding: 12px 16px; background: var(--surface);
      border: 1px solid var(--border); border-radius: 4px;
    }
    .theory-item .num { font-size: 11px; color: var(--text-dim); }
    .theory-item .title { font-size: 13px; color: var(--highlight); margin: 4px 0; }
    .theory-item .desc { font-size: 12px; color: var(--text-dim); line-height: 1.5; }

    /* 圧縮ベンチマーク */
    .bench-table { width: 100%; border-collapse: collapse; }
    .bench-table th, .bench-table td {
      padding: 8px 12px; text-align: left;
      border-bottom: 1px solid var(--border); font-size: 13px;
    }
    .bench-table th { color: var(--text-dim); font-weight: normal; }
    .bar {
      height: 8px; background: var(--accent); border-radius: 4px;
      display: inline-block; min-width: 4px;
    }

    /* 七価論理バッジ */
    .logic-badge {
      display: inline-block; padding: 2px 8px;
      border-radius: 10px; font-size: 11px; font-family: monospace;
    }
    .TRUE     { background: #1a3a1a; color: #88cc88; }
    .BOTH     { background: #3a1a3a; color: #cc88cc; }
    .NEITHER  { background: #1a2a3a; color: #8888cc; }
    .FLOWING  { background: #1a3a3a; color: #88cccc; }
  </style>
</head>
<body>
  <header>
    <h1>AXIOM OS</h1>
    <span>D-FUMT Theory Research Platform — 七価論理知識基盤</span>
  </header>

  <nav>
    <button class="active" onclick="showPanel('chat')">歴史人物チャット</button>
    <button onclick="showPanel('axioms')">公理ブラウザ</button>
    <button onclick="showPanel('bench')">圧縮ベンチマーク</button>
    <button onclick="showPanel('universal')">汎用チャット</button>
    <button onclick="showPanel('memory')">記憶ログ</button>
    <button onclick="showPanel('dictionary')">辞書</button>
    <button onclick="showPanel('nostr')">Nostr共有</button>
  </nav>

  <!-- 歴史人物チャットパネル -->
  <div id="panel-chat" class="panel active">
    <div class="persona-grid" id="persona-grid">
      ${HISTORICAL_PERSONAS.map(p => `
      <div class="persona-card" onclick="selectPersona('${p.id}')" id="card-${p.id}">
        <div class="name">${p.emoji} ${p.nameJa}</div>
        <div class="era">${p.period} / ${p.origin}</div>
        <span class="logic-badge ${p.dfumtAffinity}">${p.dfumtAffinity}</span>
      </div>`).join('')}
    </div>
    <div class="persona-provider-bar" style="display:flex;gap:0.5rem;align-items:center;margin-bottom:8px;flex-wrap:wrap">
      <label style="font-size:0.8rem;color:#888">AIプロバイダー:</label>
      <select id="persona-provider" onchange="changePersonaProvider()" style="background:var(--surface);color:var(--text);border:1px solid #444;border-radius:6px;padding:0.3rem 0.5rem;font-size:0.8rem">
        <option value="ollama">Ollama（無料・ローカル）</option>
        <option value="groq">Groq（無料枠）</option>
        <option value="anthropic">Claude API</option>
        <option value="openai">OpenAI GPT</option>
        <option value="gemini">Gemini（無料枠）</option>
      </select>
      <input type="password" id="persona-api-key"
        placeholder="APIキー（Ollama不要）"
        style="background:var(--surface);color:var(--text);border:1px solid #555;border-radius:6px;padding:0.3rem 0.5rem;font-size:0.8rem;width:200px"/>
      <span id="persona-status" style="font-size:0.75rem;color:#666"></span>
    </div>
    <div class="chat-area" id="chat-area">
      <div class="msg assistant">
        <div class="role">Axiom OS</div>
        <div class="content">歴史上の人物を選択してください。LLMを通じて、その人物らしい自然な会話ができます。</div>
      </div>
    </div>
    <div class="chat-input">
      <input id="chat-input" type="text" placeholder="質問を入力（例: ご飯食べたいですね）" />
      <button onclick="sendMessage()">送信</button>
    </div>
  </div>

  <!-- 公理ブラウザパネル -->
  <div id="panel-axioms" class="panel">
    <div class="theory-list">
      ${theories.map(t => `
      <div class="theory-item">
        <div class="num">Theory #${t.num}</div>
        <div class="title">${t.title}</div>
        <div class="desc">${t.description}</div>
      </div>`).join('')}
    </div>
  </div>

  <!-- 圧縮ベンチマークパネル -->
  <div id="panel-bench" class="panel">
    <p style="color:var(--text-dim);font-size:12px;margin-bottom:16px">
      SEED_KERNEL（75理論）に対する各圧縮方式の実績値
    </p>
    <table class="bench-table">
      <tr><th>方式</th><th>マジックバイト</th><th>圧縮率</th><th>特徴</th></tr>
      ${BENCH_DATA.map(b => `
      <tr>
        <td>${b.name}</td>
        <td style="font-family:monospace;font-size:11px">${b.magic}</td>
        <td>
          <span class="bar" style="width:${b.ratio * 2}px"></span>
          <span style="margin-left:8px">${b.ratio}%</span>
        </td>
        <td style="color:var(--text-dim)">${b.desc}</td>
      </tr>`).join('')}
    </table>
  </div>

  ${universalChatPanel}

  <!-- 記憶ログパネル -->
  <div id="panel-memory" class="panel">
    <div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:1rem">
      <span id="memory-count-badge" style="font-size:0.85rem;color:var(--dfumt)">記憶: 0件</span>
      <button onclick="showMemoryPanel()" class="btn-small" style="background:#333;color:#ccc;border:none;border-radius:4px;padding:0.3rem 0.6rem;cursor:pointer;font-size:0.75rem">更新</button>
      <button onclick="clearMemory()" class="btn-small" style="background:#442222;color:#cc8888;border:none;border-radius:4px;padding:0.3rem 0.6rem;cursor:pointer;font-size:0.75rem">記憶をクリア</button>
    </div>
    <div id="memory-panel" class="memory-panel" style="max-height:500px;overflow-y:auto"></div>
  </div>

  <style>
  .memory-item {
    background: #1e1e28;
    border-radius: 8px;
    padding: 0.6rem;
    margin-bottom: 0.5rem;
    border-left: 3px solid var(--dfumt);
  }
  .memory-q { color: #aabbcc; font-size: 0.85rem; margin-top: 0.3rem; }
  .memory-a { color: #888899; font-size: 0.8rem; margin-top: 0.2rem; }
  .memory-meta { display: flex; gap: 0.5rem; align-items: center; }
  </style>

  ${dictionaryPanel}

  ${nostrPanel}

  <script>
    let selectedPersona = null;
    const historicalPersonas = ${JSON.stringify(HISTORICAL_PERSONAS)};
    let personaConversations = {};
    let personaProvider = 'ollama';
    let personaApiKey = '';

    function showPanel(name) {
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
      document.getElementById('panel-' + name).classList.add('active');
      event.target.classList.add('active');
    }

    function selectPersona(id) {
      document.querySelectorAll('.persona-card').forEach(c => c.classList.remove('selected'));
      document.getElementById('card-' + id).classList.add('selected');
      selectedPersona = historicalPersonas.find(p => p.id === id);
      if (!personaConversations[id]) personaConversations[id] = [];
      appendMsg('Axiom OS', selectedPersona.emoji + ' ' + selectedPersona.nameJa +
        'を選択しました。' + selectedPersona.greeting);
    }

    function changePersonaProvider() {
      personaProvider = document.getElementById('persona-provider').value;
      personaApiKey = document.getElementById('persona-api-key').value.trim();
      document.getElementById('persona-status').textContent =
        personaProvider + ' に切り替えました';
    }

    function appendMsg(role, content) {
      const area = document.getElementById('chat-area');
      const cls = role === 'You' ? 'user' : 'assistant';
      area.innerHTML += '<div class="msg ' + cls + '"><div class="role">' +
        escPersonaHtml(role) +
        '</div><div class="content">' + escPersonaHtml(content) + '</div></div>';
      area.scrollTop = area.scrollHeight;
    }

    function escPersonaHtml(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    async function sendMessage() {
      const input = document.getElementById('chat-input');
      const text = input.value.trim();
      if (!text) return;
      if (!selectedPersona) { appendMsg('Axiom OS', '先に歴史人物を選択してください。'); return; }

      appendMsg('You', text);
      input.value = '';

      const pid = selectedPersona.id;
      if (!personaConversations[pid]) personaConversations[pid] = [];
      personaConversations[pid].push({ role: 'user', content: text });

      const status = document.getElementById('persona-status');
      status.textContent = '⏳ ' + selectedPersona.nameJa + ' が考え中...';

      try {
        const apiKey = document.getElementById('persona-api-key').value.trim();
        const response = await callPersonaAPI({
          provider: personaProvider,
          apiKey: apiKey,
          systemPrompt: selectedPersona.systemPrompt,
          messages: personaConversations[pid],
        });
        personaConversations[pid].push({ role: 'assistant', content: response });
        appendMsg(selectedPersona.emoji + ' ' + selectedPersona.nameJa, response);
        status.textContent = '✓ ' + personaProvider + ' via LLM';
      } catch (e) {
        // フォールバック応答
        const fallback = getPersonaFallback(selectedPersona, text);
        personaConversations[pid].push({ role: 'assistant', content: fallback });
        appendMsg(selectedPersona.emoji + ' ' + selectedPersona.nameJa, fallback);
        status.textContent = '⚠ フォールバック応答（' + e.message + '）';
      }
    }

    async function callPersonaAPI(opts) {
      var provider = opts.provider, apiKey = opts.apiKey;
      var systemPrompt = opts.systemPrompt, messages = opts.messages;
      var msgs = messages.map(function(m) { return { role: m.role, content: m.content }; });

      if (provider === 'ollama') {
        var res = await fetch('http://localhost:11434/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama3.2',
            messages: [{ role: 'system', content: systemPrompt }].concat(msgs),
            stream: false,
          }),
        });
        var data = await res.json();
        return (data.message ? data.message.content : '') || data.response || '';
      } else if (provider === 'anthropic') {
        var res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001', max_tokens: 500,
            system: systemPrompt, messages: msgs,
          }),
        });
        var data = await res.json();
        if (data.error) throw new Error(data.error.message);
        return data.content && data.content[0] ? data.content[0].text : '';
      } else if (provider === 'gemini') {
        var geminiMsgs = msgs.map(function(m) {
          return { role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] };
        });
        var res = await fetch(
          'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + apiKey,
          { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: geminiMsgs }) });
        var data = await res.json();
        if (data.error) throw new Error(data.error.message);
        return data.candidates && data.candidates[0] && data.candidates[0].content
          ? data.candidates[0].content.parts[0].text : '';
      } else {
        // OpenAI互換（Groq・OpenAI等）
        var baseUrls = {
          openai: 'https://api.openai.com/v1',
          groq: 'https://api.groq.com/openai/v1',
        };
        var defaultModels = { openai: 'gpt-4o-mini', groq: 'llama-3.3-70b-versatile' };
        var baseUrl = baseUrls[provider] || 'https://api.groq.com/openai/v1';
        var res = await fetch(baseUrl + '/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
          body: JSON.stringify({
            model: defaultModels[provider] || 'gpt-4o-mini',
            messages: [{ role: 'system', content: systemPrompt }].concat(msgs),
            max_tokens: 500, temperature: 0.8,
          }),
        });
        var data = await res.json();
        if (data.error) throw new Error(typeof data.error === 'string' ? data.error : data.error.message);
        return data.choices && data.choices[0] ? data.choices[0].message.content : '';
      }
    }

    function getPersonaFallback(persona, msg) {
      var lower = msg.toLowerCase();
      if (lower.indexOf('ご飯') >= 0 || lower.indexOf('食べ') >= 0 ||
          lower.indexOf('食事') >= 0 || lower.indexOf('料理') >= 0) {
        var foodReply = {
          nagarjuna: 'それは良いですね。食もまた縁起によって生じる。何を食べたいですか？',
          buddha: '食欲は自然なもの。中道をもって食事を楽しんでください。',
          dogen: '食事もまた修行のひとつ。丁寧にいただきましょう。何を召し上がりますか？',
          socrates: '空腹は知恵の友とも言う。何を食べるつもりですか？',
          wittgenstein: '食欲は語りえる欲求ですね。何にしますか？',
          laozi: '腹が減れば食べる。それが道。何を食べますか？',
          confucius: '食事は礼の基本。しっかり食べましょう。何をいただきますか？',
          kant: '食欲は自然な欲求です。節度をもって食事をとりましょう。',
          nietzsche: '食べよ！生への意志だ。何を食べる？',
          himiko: '大地の恵みに感謝して。今日は何をいただきますか？',
        };
        return foodReply[persona.id] || 'それは良いですね。何を食べたいですか？';
      }
      return persona.nameJa + 'として、「' + msg + '」についてお答えします。（LLM接続でより自然な会話ができます）';
    }

    document.getElementById('chat-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') sendMessage();
    });

    const BENCH_DATA = [
      {name:'HybridCompressor', magic:'REI\\\\x02', ratio:33.6, desc:'汎用3段階'},
      {name:'DeltaCompressor',  magic:'REI\\\\x03', ratio:39.7, desc:'辞書+デルタ差分'},
      {name:'AxiomRCT',         magic:'REI\\\\x05', ratio:41.0, desc:'縁起グラフ・Theory #67'},
      {name:'LLMZip',           magic:'REI\\\\x04', ratio:47.0, desc:'統計予測・ヒット率67%'},
    ];

    ${memoryScript}
  </script>
</body>
</html>`;
}

// ─── デフォルトデータ ─────────────────────────────────────────
export interface PersonaUI {
  id: string;
  name: string;
  era: string;
  logic: string;
  logicDisplay: string;
  responses: string[];
}

export interface TheoryUI {
  num: number;
  title: string;
  description: string;
}

export interface WebUIOptions {
  personas?: PersonaUI[];
  theories?: TheoryUI[];
}

const DEFAULT_PERSONAS: PersonaUI[] = [
  { id: 'nagarjuna', name: '龍樹', era: '2-3世紀・インド', logic: 'BOTH', logicDisplay: 'B（空）',
    responses: [
      '一切の事物は自性を持たず、縁起によって生じる。これはD-FUMT「NEITHER」値——真でも偽でもない空の状態です。',
      '「空」とは虚無ではなく、すべての可能性を内包する状態。七価論理の「BOTH」がそれを表します。',
    ]},
  { id: 'buddha', name: '釈迦牟尼', era: '紀元前5世紀', logic: 'NEITHER', logicDisplay: 'N（中道）',
    responses: [
      '苦の原因は執着。D-FUMT理論において、真に執着することは「TRUE」に固定されること——中道はFLOWINGです。',
      '縁起の法——これがあれば彼があり、これがなければ彼もない。まさにAxiom OSの公理依存グラフの哲学です。',
    ]},
  { id: 'dogen', name: '道元', era: '13世紀・日本', logic: 'FLOWING', logicDisplay: '～（流れ）',
    responses: [
      '「而今の山水は、古仏の道現成なり」——現在このコードが動くこと自体が公案です。',
      '只管打坐。ただひたすらコードを書くこと。それがD-FUMTの実践です。',
    ]},
  { id: 'socrates', name: 'ソクラテス', era: '紀元前5世紀', logic: 'TRUE', logicDisplay: '⊤（問答）',
    responses: [
      'あなたは圧縮とは何かを知っていると思っているが、本当に知っているのか？無知の知こそが七価論理の出発点です。',
      '「汝自身を知れ」——自分のコードがどの公理から生まれたか知ることが、真の理解です。',
    ]},
  { id: 'wittgenstein', name: 'ウィトゲンシュタイン', era: '20世紀', logic: 'BOTH', logicDisplay: 'B（言語)/',
    responses: [
      '「語り得ないことについては、沈黙しなければならない」——しかしD-FUMTはその沈黙をNEITHER値として表現します。',
      '言語ゲームとしての七価論理——TRUEとFALSEの二値論理は、一つの言語ゲームに過ぎない。',
    ]},
  { id: 'laozi', name: '老子', era: '紀元前6世紀', logic: 'ZERO', logicDisplay: '〇（無）',
    responses: [
      '「道可道、非常道」——表現できる道は永遠の道ではない。D-FUMTのZERO値がその「無」を表します。',
      '最良のコードは水のようなもの——どんな容器にも合わせ、低いところに流れる。これがFLOWING値の本質です。',
    ]},
];

const DEFAULT_THEORIES: TheoryUI[] = [
  { num: 1,  title: '四値catuṣkoṭi論理', description: '真・偽・両方・どちらでもない。インド哲学の四句を論理値として形式化。' },
  { num: 3,  title: '零π拡張理論', description: '零と円周率の関係を数学的に探求。ZERO値（4.0）の哲学的基盤。' },
  { num: 5,  title: '螺旋数論', description: '黄金比φと螺旋構造の関係。std/math.phi()の理論的根拠。' },
  { num: 7,  title: '意識数学SAC公理', description: '意識をC1-C6の公理系として形式化。AIの自己認識モデル。' },
  { num: 12, title: 'UMTE（統一数学理論拡張）', description: 'U1-U5: 数学の基礎を七価論理で再構築。' },
  { num: 23, title: 'D-FUMT完全七価論理', description: '四値catuṣkoṭiをINFINITY/ZERO/FLOWINGで拡張した七価体系。' },
  { num: 67, title: 'RCT（Rei圧縮理論）', description: '縁起グラフの最小全域木を用いた意味保持圧縮。マジックバイトREI\\x05。' },
  { num: 75, title: 'SEED_KERNEL統合理論', description: '75理論の統合核。全D-FUMT理論の交差点。' },
];

const BENCH_DATA = [
  { name: 'HybridCompressor', magic: 'REI\\x02', ratio: 33.6, desc: '汎用3段階' },
  { name: 'DeltaCompressor',  magic: 'REI\\x03', ratio: 39.7, desc: '辞書+デルタ差分' },
  { name: 'AxiomRCT',         magic: 'REI\\x05', ratio: 41.0, desc: '縁起グラフ・Theory #67' },
  { name: 'LLMZip',           magic: 'REI\\x04', ratio: 47.0, desc: '統計予測・ヒット率67%' },
];
