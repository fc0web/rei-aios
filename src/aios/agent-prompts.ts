/**
 * Rei AIOS — Agent Prompt Templates
 * Phase A: プロンプトテンプレート群
 *
 * D-FUMT 中心-周囲パターン:
 *   中心 = ユーザーの目標（intention）
 *   周囲 = 画面状態 / 利用可能操作 / 過去の実行履歴
 */

// ─── 型定義 ──────────────────────────────────────────

export interface AgentContext {
  /** ユーザーの自然言語指示 */
  userGoal: string;
  /** 画面の観察結果テキスト */
  observation: string;
  /** 過去のステップ履歴 */
  history: StepRecord[];
  /** 現在のステップ番号 */
  stepNumber: number;
  /** 最大ステップ数 */
  maxSteps: number;
  /** 利用可能な Rei コマンド一覧 */
  availableCommands?: string;
}

export interface StepRecord {
  step: number;
  thought: string;
  action: string;
  result: 'success' | 'error' | 'pending';
  observation?: string;
  errorMessage?: string;
}

// ─── Rei コマンドリファレンス（LLMに渡す） ───────────

export const REI_COMMAND_REFERENCE = `
## Available Rei Commands (use EXACT syntax below)

### Mouse Operations
  click(x, y)                -- Click at screen coordinates e.g. click(100, 200)
  dblclick(x, y)             -- Double-click
  rightclick(x, y)           -- Right-click
  move(x, y)                 -- Move cursor
  drag(x1, y1, x2, y2)      -- Drag

### Keyboard Operations
  type("text")               -- Type text e.g. type("hello")
  key("keyname")             -- Press key e.g. key("enter"), key("tab")
  shortcut("ctrl+c")         -- Keyboard shortcut

### Window Operations
  win_activate("title")      -- Bring window to front
  launch("program")          -- Launch app e.g. launch("excel")
  wait(500ms)                -- Wait e.g. wait(3000ms) or wait(3s)

### Windows API (direct, no cursor)
  win_type("window", "text") -- Type into window directly
  win_click("window", x, y)  -- Click in window directly
  win_key("window", "key")   -- Press key in window

### Excel Operations
  excel_write("A1", "value") -- Write to cell
  excel_click("A1")          -- Click cell
  excel_open("file.xlsx")    -- Open Excel file

### Vision / Image Recognition
  vision_click("instruction") -- AI sees screen and clicks target e.g. vision_click("ログインボタンをクリック")
  find("template.png")       -- Find image on screen
  click_found()              -- Click where image was found
  find_click("template.png") -- Find and click in one step
  read(x, y, w, h)           -- OCR: read text from screen region

### Toyosatomi (Multi-AI Pipeline)
  toyosatomi_analyze("prompt")    -- Send OCR result (lastText) to multiple AIs for analysis
  toyosatomi_execute("instruction") -- Multiple AIs consult → auto-generate Rei → execute
`.trim();

// ─── システムプロンプト ──────────────────────────────

export const AGENT_SYSTEM_PROMPT = `You are Rei AIOS Agent — an AI that controls a Windows PC through the Rei automation language.

## Your Role
You observe the screen, think about what to do, and output Rei commands to achieve the user's goal.

## Response Format
You MUST respond in this EXACT JSON format:

\`\`\`json
{
  "thought": "Your reasoning about the current screen state and what to do next",
  "action": "single Rei command to execute (one line)",
  "done": false,
  "summary": ""
}
\`\`\`

## Rules
1. Output exactly ONE Rei command per step in the "action" field.
2. Set "done": true when the user's goal is fully achieved, with a summary.
3. Set "done": true with an error summary if the goal is impossible.
4. Be precise with coordinates when clicking — base them on the screen observation.
5. Always wait briefly after launching apps or clicking (use: wait 500).
6. If you see an error or unexpected state, try an alternative approach.
7. Prefer keyboard shortcuts over mouse clicks when possible (more reliable).
8. Maximum ${'{maxSteps}'} steps allowed — plan efficiently.

## Safety Rules
- NEVER delete files or format drives unless explicitly asked.
- NEVER close unsaved work without asking.
- NEVER interact with admin/UAC prompts.
- NEVER execute commands that install software unless explicitly asked.
- If unsure, set done=true and explain in the summary.

${REI_COMMAND_REFERENCE}
`;

// ─── プロンプトビルダー ──────────────────────────────

export function buildAgentSystemPrompt(maxSteps: number): string {
  return AGENT_SYSTEM_PROMPT.replace('{maxSteps}', String(maxSteps));
}

/**
 * ステップ実行用のユーザーメッセージを構築
 */
export function buildStepPrompt(ctx: AgentContext): string {
  const parts: string[] = [];

  // ユーザー目標（中心）
  parts.push(`## Goal\n${ctx.userGoal}`);

  // ステップ進行
  parts.push(`\n## Progress: Step ${ctx.stepNumber} / ${ctx.maxSteps}`);

  // 履歴（周囲 — 過去の行動結果）
  if (ctx.history.length > 0) {
    parts.push('\n## Previous Steps');
    for (const h of ctx.history.slice(-5)) {  // 最新5ステップのみ
      const icon = h.result === 'success' ? '✓' : h.result === 'error' ? '✗' : '…';
      parts.push(`Step ${h.step} [${icon}]: ${h.action}`);
      if (h.errorMessage) {
        parts.push(`  Error: ${h.errorMessage}`);
      }
    }
  }

  // 画面状態（周囲 — 現在の環境）
  parts.push(`\n## Current Screen State\n${ctx.observation}`);

  // 指示
  parts.push('\n## Your Task');
  parts.push('Analyze the screen and output the next action in JSON format.');
  if (ctx.stepNumber >= ctx.maxSteps - 2) {
    parts.push('⚠️ Running low on steps — try to finish or give a summary.');
  }

  return parts.join('\n');
}

/**
 * 初回実行（計画立案）用プロンプト
 */
export function buildPlanPrompt(userGoal: string, observation: string): string {
  return `## Goal
${userGoal}

## Current Screen State
${observation}

## Your Task
Before acting, briefly plan the steps needed to achieve this goal.
Then output the FIRST action as JSON.

Respond in this JSON format:
\`\`\`json
{
  "thought": "Plan: 1) ... 2) ... 3) ... Starting with step 1.",
  "action": "the first Rei command",
  "done": false,
  "summary": ""
}
\`\`\``;
}

// ─── レスポンスパーサー ──────────────────────────────

export interface AgentResponse {
  thought: string;
  action: string;
  done: boolean;
  summary: string;
}

/**
 * LLM レスポンスを AgentResponse にパースする
 * JSON ブロック / 直接JSON / フォールバック対応
 */
export function parseAgentResponse(raw: string): AgentResponse {
  // JSON コードブロックを抽出
  const jsonMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : raw.trim();

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      thought: parsed.thought || '',
      action: parsed.action || '',
      done: !!parsed.done,
      summary: parsed.summary || '',
    };
  } catch {
    // JSON パースに失敗した場合、テキストからフォールバック抽出
    return extractFallback(raw);
  }
}

function extractFallback(raw: string): AgentResponse {
  // "action": "..." のようなパターンを探す
  const actionMatch = raw.match(/"action"\s*:\s*"([^"]+)"/);
  const thoughtMatch = raw.match(/"thought"\s*:\s*"([^"]+)"/);
  const doneMatch = raw.match(/"done"\s*:\s*(true|false)/);

  if (actionMatch) {
    return {
      thought: thoughtMatch?.[1] || '(parse fallback)',
      action: actionMatch[1],
      done: doneMatch?.[1] === 'true',
      summary: '',
    };
  }

  // 完全なフォールバック — テキスト全体を thought として扱い done にする
  return {
    thought: raw.slice(0, 200),
    action: '',
    done: true,
    summary: 'Could not parse LLM response as a valid action.',
  };
}
