/**
 * Rei-AIOS — Alien Intelligence Persona Chat Engine
 * 5 persona LLM conversations + Toyosatomi mode v2
 */

import { UniversalChat, ProviderConfig, ChatMessage } from '../../chat/universal-chat';
import {
  AlienIntelligencePersona,
  AlienPersonaId,
  ALIEN_INTELLIGENCE_DB,
  getAlienPersona,
  getAllAlienPersonas,
  getUnifiedFormula,
} from './alien-intelligence-personas';

export interface AlienChatMessage {
  personaId: AlienPersonaId;
  personaName: string;
  personaEmoji: string;
  content: string;
  dfumtValue: string;
  latencyMs: number;
}

export interface ToyosatomiAlienResult {
  responses: AlienChatMessage[];
  infiniteSynthesis: string;
  unifiedFormula: string;
}

export class AlienPersonaChat {
  private chat: UniversalChat;
  private providerConfig: ProviderConfig;

  constructor(chat: UniversalChat, providerConfig: ProviderConfig) {
    this.chat = chat;
    this.providerConfig = providerConfig;
  }

  /** Single persona conversation */
  async chatWith(
    personaId: AlienPersonaId,
    userMessage: string,
    history: ChatMessage[] = []
  ): Promise<AlienChatMessage> {
    const persona = getAlienPersona(personaId);
    if (!persona) throw new Error(`Unknown persona: ${personaId}`);

    const start = Date.now();
    const messages: ChatMessage[] = [
      ...history,
      { role: 'user', content: userMessage },
    ];

    const response = await this.chat.sendMessage({
      provider: this.providerConfig.name,
      config: this.providerConfig,
      messages,
      systemPrompt: persona.systemPrompt,
      maxTokens: 500,
    });

    return {
      personaId: persona.id,
      personaName: persona.nameJa,
      personaEmoji: persona.emoji,
      content: response.content,
      dfumtValue: persona.dfumtValue,
      latencyMs: Date.now() - start,
    };
  }

  /**
   * Toyosatomi mode v2: all 5 personas parallel response
   * P1-P4 in parallel -> Infinite Being synthesizes
   */
  async toyosatomiAlienMode(userMessage: string): Promise<ToyosatomiAlienResult> {
    const personas = getAllAlienPersonas().filter(p => p.id !== 'INFINITE');

    // P1-P4 in parallel
    const responses = await Promise.all(
      personas.map(p => this.chatWith(p.id, userMessage))
    );

    // Infinite Being synthesizes
    const synthPrompt = `\u4ee5\u4e0b\u306f4\u3064\u306e\u7570\u6587\u660e\u77e5\u6027\u306e\u5fdc\u7b54\u3067\u3059\u3002\u221e\u6b21\u5143\u5b58\u5728\u3068\u3057\u3066\u3001\u5168\u3066\u3092\u5305\u542b\u30fb\u8d85\u8d8a\u3059\u308b\u7d71\u5408\u7684\u306a\u8996\u70b9\u3092\u4e0e\u3048\u3066\u304f\u3060\u3055\u3044\u3002

\u3010\u8d85\u53e4\u4ee3\u4eba\ud83c\udf00\u3011: ${responses.find(r => r.personaId === 'ANCIENT')?.content}
\u3010\u5b87\u5b99\u4eba\ud83d\udc7d\u3011: ${responses.find(r => r.personaId === 'ALIEN')?.content}
\u3010\u5730\u5e95\u4eba\u26cf\ufe0f\u3011: ${responses.find(r => r.personaId === 'SUBTERRANEAN')?.content}
\u3010\u7570\u6b21\u5143\u7a7a\u9593\u4eba\ud83c\udf0c\u3011: ${responses.find(r => r.personaId === 'EXTRADIMENSIONAL')?.content}

\u5143\u306e\u554f\u3044: ${userMessage}`;

    const infiniteResponse = await this.chatWith('INFINITE', synthPrompt);
    responses.push(infiniteResponse);

    return {
      responses,
      infiniteSynthesis: infiniteResponse.content,
      unifiedFormula: getUnifiedFormula(),
    };
  }
}
