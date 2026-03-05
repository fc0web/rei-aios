/**
 * Rei-AIOS STEP 9-B — AIOSChannel
 * AIエージェント間通信基盤
 *
 * アーキテクチャ:
 *   - チャンネル: AIが参加するグループ通信空間
 *   - メッセージ: D-FUMT七価論理で「重要度」を付与
 *   - Toyosatomiモード: 複数AIが同じ問いに並列回答し、
 *     七価論理で統合（聖徳太子が10人の訴えを同時に聞いた故事より）
 */

export type MessageRole = 'user' | 'agent' | 'system' | 'broadcast';
export type DFUMTValue = 'TRUE' | 'FALSE' | 'BOTH' | 'NEITHER' | 'INFINITY' | 'ZERO' | 'FLOWING';

export interface AIMessage {
  id: string;
  channelId: string;
  fromAgent: string;
  toAgent: string | 'broadcast';  // 'broadcast'=全員に送信
  role: MessageRole;
  content: string;
  dfumtWeight: DFUMTValue;        // メッセージの重要度
  timestamp: string;
  replyTo?: string;               // 返信先メッセージID
  metadata?: Record<string, unknown>;
}

export interface AIChannel {
  id: string;
  name: string;
  members: string[];              // 参加エージェントID
  messages: AIMessage[];
  createdAt: string;
}

export interface ToyosatomiResult {
  question: string;
  responses: { agentId: string; content: string; weight: DFUMTValue }[];
  synthesis: string;              // 七価論理統合結果
  consensus: DFUMTValue;          // 全体的な合意レベル
}

// ─── AIOSChannel メインクラス ──────────────────────────────────
export class AIOSChannel {
  private channels: Map<string, AIChannel> = new Map();

  // ── チャンネル作成 ──────────────────────────────────────────
  createChannel(name: string, members: string[]): AIChannel {
    const id = `ch_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
    const channel: AIChannel = {
      id, name, members, messages: [],
      createdAt: new Date().toISOString(),
    };
    this.channels.set(id, channel);
    return channel;
  }

  // ── メッセージ送信 ──────────────────────────────────────────
  send(
    channelId: string,
    fromAgent: string,
    toAgent: string | 'broadcast',
    content: string,
    opts: {
      role?: MessageRole;
      dfumtWeight?: DFUMTValue;
      replyTo?: string;
      metadata?: Record<string, unknown>;
    } = {}
  ): AIMessage | null {
    const channel = this.channels.get(channelId);
    if (!channel) return null;
    if (!channel.members.includes(fromAgent)) return null;

    const msg: AIMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      channelId,
      fromAgent,
      toAgent,
      role: opts.role ?? 'agent',
      content,
      dfumtWeight: opts.dfumtWeight ?? 'TRUE',
      timestamp: new Date().toISOString(),
      replyTo: opts.replyTo,
      metadata: opts.metadata,
    };

    channel.messages.push(msg);
    return msg;
  }

  // ── メッセージ受信 ──────────────────────────────────────────
  receive(channelId: string, agentId: string): AIMessage[] {
    const channel = this.channels.get(channelId);
    if (!channel) return [];

    return channel.messages.filter(m =>
      m.toAgent === agentId || m.toAgent === 'broadcast'
    );
  }

  // ── Toyosatomiモード: 複数AI並列回答 + 七価論理統合 ──────────
  // 聖徳太子が10人の訴えを同時に聞いたように、
  // 複数AIの回答を七価論理で統合する
  toyosatomi(
    channelId: string,
    question: string,
    responses: { agentId: string; content: string; weight: DFUMTValue }[]
  ): ToyosatomiResult {
    // 七価論理の重み付け
    const weights: Record<DFUMTValue, number> = {
      TRUE: 1.0, FALSE: 0.0, BOTH: 0.7,
      NEITHER: 0.5, INFINITY: 0.9, ZERO: 0.1, FLOWING: 0.6,
    };

    // 重み付き合意スコア
    const totalWeight = responses.reduce((s, r) => s + weights[r.weight], 0);
    const avgWeight = responses.length > 0 ? totalWeight / responses.length : 0;

    // 合意レベルを七価論理で表現
    let consensus: DFUMTValue;
    if (avgWeight >= 0.9) consensus = 'TRUE';
    else if (avgWeight >= 0.7) consensus = 'BOTH';
    else if (avgWeight >= 0.5) consensus = 'FLOWING';
    else if (avgWeight >= 0.3) consensus = 'NEITHER';
    else consensus = 'FALSE';

    // 統合サマリ生成
    const agentList = responses.map(r => r.agentId).join('・');
    const synthesis = [
      `【Toyosatomiモード統合】`,
      `問い: ${question}`,
      `参加AI: ${agentList}（${responses.length}名）`,
      `合意レベル: ${consensus}`,
      `各回答:`,
      ...responses.map(r =>
        `  [${r.agentId}/${r.weight}] ${r.content.slice(0, 100)}`
      ),
    ].join('\n');

    // チャンネルにシステムメッセージとして記録
    const channel = this.channels.get(channelId);
    if (channel) {
      channel.messages.push({
        id: `toyosatomi_${Date.now()}`,
        channelId,
        fromAgent: 'system',
        toAgent: 'broadcast',
        role: 'system',
        content: synthesis,
        dfumtWeight: consensus,
        timestamp: new Date().toISOString(),
      });
    }

    return { question, responses, synthesis, consensus };
  }

  // ── チャンネル情報取得 ──────────────────────────────────────
  getChannel(channelId: string): AIChannel | null {
    return this.channels.get(channelId) ?? null;
  }

  listChannels(): AIChannel[] {
    return Array.from(this.channels.values());
  }

  messageCount(channelId: string): number {
    return this.channels.get(channelId)?.messages.length ?? 0;
  }
}
