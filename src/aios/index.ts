/**
 * Rei AIOS — Module Exports
 * v0.5.0: AIアシスタント機能
 */

// LLM共通
export { ILLMAdapter, LLMRequest, LLMResponse, LLMProviderConfig, LLMAdapterStatus, LLMMessage } from './llm-adapter';

// LLMアダプタ
export { ClaudeAdapter } from './claude-adapter';
export { OpenAIAdapter } from './openai-adapter';
export { OpenAICompatAdapter } from './openai-compat-adapter';
export { OllamaAdapter } from './ollama-adapter';

// LLMマネージャー
export { LLMManager } from './llm-manager';

// 公理分岐
export { AxiomBrancher, BranchResult, Branch, QuestionType } from './axiom-brancher';

// チャット履歴
export { ChatStore, ChatSession, ChatMessage, ChatSessionSummary } from './chat-store';

// 統合エンジン
export { AIOSEngine, AIOSConfig, ChatRequest, ChatResponse } from './aios-engine';

// REST APIルート
export { createAIOSRoutes } from './aios-routes';

// Phase A: Agent Loop（Observe → Think → Act）
export { AgentLoop, AgentLoopConfig, AgentLoopResult } from './agent-loop';
export { ScreenObserver, ScreenObservation, ScreenObserverConfig, WindowInfo } from './screen-observer';
export { ActionExecutor, ActionResult, ActionExecutorConfig } from './action-executor';
export {
  AgentResponse, AgentContext, StepRecord,
  buildAgentSystemPrompt, buildStepPrompt, buildPlanPrompt,
  parseAgentResponse, REI_COMMAND_REFERENCE,
} from './agent-prompts';
