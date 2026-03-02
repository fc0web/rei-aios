/**
 * Rei AIOS — AI Agent CLI Entry Point
 * Phase A: 自然言語で PC 操作を指示する CLI
 *
 * Usage:
 *   rei-ai "メモ帳に挨拶を書いて"
 *   rei-ai --goal "Open Notepad and type Hello World"
 *   rei-ai --interactive              — 対話モード
 *   rei-ai --dry-run "..."           — 実行せずに計画を表示
 *   rei-ai --provider claude --model claude-sonnet-4-20250514 "..."
 *   rei-ai --max-steps 30 "..."
 */

import * as path from 'path';
import * as fs from 'fs';
import { AgentLoop, AgentLoopConfig, AgentLoopResult } from './agent-loop';
import { LLMProviderConfig } from './llm-adapter';

// ─── 定数 ────────────────────────────────────────────

const VERSION = '0.1.0-agent';
const DEFAULT_DATA_DIR = './data/rei-aios';
const DEFAULT_CONFIG_FILE = './rei-aios.json';

// ─── CLI設定型 ────────────────────────────────────────

interface CLIConfig {
  dataDir: string;
  maxSteps: number;
  stepDelayMs: number;
  dryRun: boolean;
  providerId?: string;
  model?: string;
  useVision: boolean;
  verbose: boolean;
  interactive: boolean;
}

const DEFAULT_CLI_CONFIG: CLIConfig = {
  dataDir: DEFAULT_DATA_DIR,
  maxSteps: 20,
  stepDelayMs: 1000,
  dryRun: false,
  useVision: false,
  verbose: false,
  interactive: false,
};

// ─── メイン ──────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    return;
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log(`Rei AIOS Agent v${VERSION}`);
    return;
  }

  // 設定を解析
  const { config, goal } = parseArgs(args);

  // プロバイダー設定をチェック
  if (args.includes('--setup')) {
    await handleSetup(config);
    return;
  }

  if (config.interactive) {
    await handleInteractive(config);
    return;
  }

  if (!goal) {
    console.error('Error: No goal specified. Use: rei-ai "your instruction"');
    process.exit(1);
  }

  // 単発実行
  await handleSingleRun(goal, config);
}

// ─── コマンドハンドラ ────────────────────────────────

/**
 * 単発実行
 */
async function handleSingleRun(goal: string, config: CLIConfig): Promise<void> {
  const agent = createAgent(config);

  // イベント購読
  agent.on('step:start', (e: any) => {
    if (config.verbose) {
      console.log(`\n── Step ${e.step}/${e.maxSteps} ──`);
    }
  });
  agent.on('step:complete', (e: any) => {
    const icon = e.result === 'success' ? '✓' : '✗';
    console.log(`  [${icon}] ${e.action}`);
    if (config.verbose && e.thought) {
      console.log(`      💭 ${e.thought.slice(0, 80)}`);
    }
    if (e.errorMessage) {
      console.log(`      ⚠ ${e.errorMessage}`);
    }
  });

  console.log(`🤖 Rei AIOS Agent v${VERSION}`);
  console.log(`   Goal: ${goal}`);
  console.log(`   Provider: ${config.providerId || 'default'}`);
  console.log(`   Max steps: ${config.maxSteps}`);
  console.log(`   Dry run: ${config.dryRun}`);
  console.log('');

  const result = await agent.run(goal);
  printResult(result);
  process.exit(result.success ? 0 : 1);
}

/**
 * 対話モード
 */
async function handleInteractive(config: CLIConfig): Promise<void> {
  const agent = createAgent(config);
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(`🤖 Rei AIOS Agent v${VERSION} — Interactive Mode`);
  console.log(`   Provider: ${config.providerId || 'default'}`);
  console.log('   Type your instruction, or "quit" to exit.\n');

  const prompt = () => {
    rl.question('rei-ai> ', async (input: string) => {
      const trimmed = input.trim();
      if (!trimmed || trimmed === 'quit' || trimmed === 'exit') {
        console.log('Goodbye!');
        rl.close();
        return;
      }

      if (trimmed === 'status') {
        const providers = agent.getLLMManager().getProviderList();
        console.log('\nConfigured providers:');
        for (const p of providers) {
          const active = p.id === agent.getLLMManager().getActiveProviderId() ? ' ←' : '';
          console.log(`  [${p.id}] ${p.name} (${p.defaultModel})${active}`);
        }
        console.log('');
        prompt();
        return;
      }

      // イベント購読（対話モード用）
      const stepHandler = (e: any) => {
        const icon = e.result === 'success' ? '✓' : '✗';
        console.log(`  [${icon}] ${e.action}`);
      };
      agent.on('step:complete', stepHandler);

      const result = await agent.run(trimmed);
      agent.off('step:complete', stepHandler);

      printResult(result);
      console.log('');
      prompt();
    });
  };

  prompt();
}

/**
 * セットアップ（API キー設定）
 */
async function handleSetup(config: CLIConfig): Promise<void> {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (q: string): Promise<string> =>
    new Promise(resolve => rl.question(q, resolve));

  console.log('🔧 Rei AIOS Agent Setup\n');

  const provider = await question('Provider [claude/openai/ollama]: ');
  const providerId = provider.trim() || 'claude';

  let apiKey = '';
  if (providerId !== 'ollama') {
    apiKey = await question(`${providerId} API Key: `);
  }

  const model = await question(`Model (leave blank for default): `);

  // 設定を保存
  const configPath = path.resolve(DEFAULT_CONFIG_FILE);
  const existing = fs.existsSync(configPath)
    ? JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    : {};

  existing.providers = existing.providers || {};
  existing.providers[providerId] = {
    apiKey: apiKey.trim(),
    model: model.trim() || undefined,
  };
  existing.activeProvider = providerId;

  fs.writeFileSync(configPath, JSON.stringify(existing, null, 2), 'utf-8');
  console.log(`\n✅ Saved to ${configPath}`);
  console.log(`   Active provider: ${providerId}`);

  rl.close();
}

// ─── ヘルパー ────────────────────────────────────────

function createAgent(config: CLIConfig): AgentLoop {
  const dataDir = path.resolve(config.dataDir);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const agentConfig: Partial<AgentLoopConfig> & { dataDir: string } = {
    dataDir,
    maxSteps: config.maxSteps,
    stepDelayMs: config.stepDelayMs,
    dryRun: config.dryRun,
    providerId: config.providerId,
    model: config.model,
    useVision: config.useVision,
    log: config.verbose
      ? (msg: string) => console.log(msg)
      : (_msg: string) => {},
  };

  const agent = new AgentLoop(agentConfig);

  // 設定ファイルからプロバイダー設定を読み込む
  loadProviderConfig(agent, config);

  return agent;
}

function loadProviderConfig(agent: AgentLoop, config: CLIConfig): void {
  // 1. 設定ファイルから
  const configPath = path.resolve(DEFAULT_CONFIG_FILE);
  if (fs.existsSync(configPath)) {
    try {
      const fileConf = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (fileConf.providers) {
        for (const [id, prov] of Object.entries(fileConf.providers as Record<string, any>)) {
          agent.updateProvider(id, {
            apiKey: prov.apiKey,
            defaultModel: prov.model,
          } as Partial<LLMProviderConfig>);
        }
      }
      if (fileConf.activeProvider) {
        agent.getLLMManager().setActiveProvider(fileConf.activeProvider);
      }
    } catch { /* ignore */ }
  }

  // 2. 環境変数から（優先度高）
  const envKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (envKey) {
    agent.updateProvider('claude', { apiKey: envKey } as Partial<LLMProviderConfig>);
  }
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    agent.updateProvider('openai', { apiKey: openaiKey } as Partial<LLMProviderConfig>);
  }
}

function parseArgs(args: string[]): { config: CLIConfig; goal: string } {
  const config = { ...DEFAULT_CLI_CONFIG };
  let goal = '';
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--dry-run':
        config.dryRun = true;
        break;
      case '--verbose':
      case '-V':
        config.verbose = true;
        break;
      case '--interactive':
      case '-i':
        config.interactive = true;
        break;
      case '--vision':
        config.useVision = true;
        break;
      case '--goal':
      case '-g':
        goal = args[++i] || '';
        break;
      case '--provider':
      case '-p':
        config.providerId = args[++i];
        break;
      case '--model':
      case '-m':
        config.model = args[++i];
        break;
      case '--max-steps':
        config.maxSteps = parseInt(args[++i], 10) || 20;
        break;
      case '--step-delay':
        config.stepDelayMs = parseInt(args[++i], 10) || 1000;
        break;
      case '--data-dir':
        config.dataDir = args[++i];
        break;
      case '--setup':
        break; // handled in main
      default:
        if (!arg.startsWith('--')) {
          positional.push(arg);
        }
        break;
    }
  }

  // 残りの位置引数をゴールとして結合
  if (!goal && positional.length > 0) {
    goal = positional.join(' ');
  }

  return { config, goal };
}

function printResult(result: AgentLoopResult): void {
  const icon = result.success ? '✅' : '❌';
  console.log(`\n${icon} Result: ${result.summary}`);
  console.log(`   Steps: ${result.totalSteps}`);
  console.log(`   Time:  ${(result.totalElapsedMs / 1000).toFixed(1)}s`);

  const successes = result.history.filter(h => h.result === 'success').length;
  const errors = result.history.filter(h => h.result === 'error').length;
  console.log(`   Success: ${successes}, Errors: ${errors}`);
}

function printUsage(): void {
  console.log(`
Rei AIOS Agent v${VERSION}
AI-powered PC automation through natural language

Usage:
  rei-ai "メモ帳に挨拶を書いて"         Natural language instruction
  rei-ai --goal "Open Notepad"          Explicit goal flag
  rei-ai --interactive                   Interactive mode
  rei-ai --setup                         Configure API keys

Options:
  --goal, -g <text>      Specify the goal
  --provider, -p <id>    LLM provider (claude, openai, ollama)
  --model, -m <name>     LLM model name
  --max-steps <n>        Maximum steps (default: 20)
  --step-delay <ms>      Delay between steps (default: 1000)
  --dry-run              Show plan without executing
  --vision               Enable screen capture for LLM (Claude only)
  --verbose, -V          Verbose output
  --interactive, -i      Interactive mode
  --setup                Configure API keys
  --data-dir <path>      Data directory (default: ./data/rei-aios)

Environment Variables:
  ANTHROPIC_API_KEY      Claude API key
  OPENAI_API_KEY         OpenAI API key

Config File: ./rei-aios.json

Examples:
  rei-ai "メモ帳を開いて Hello World と入力して"
  rei-ai --dry-run "Open Calculator and compute 42 * 3"
  rei-ai --provider openai --model gpt-4o "Summarize clipboard"
  rei-ai --interactive --verbose
`);
}

// ─── エントリ ────────────────────────────────────────
main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
