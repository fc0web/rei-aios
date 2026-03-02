/**
 * Rei AIOS — Chat Store
 * 会話履歴のローカル永続化（JSONファイルベース）
 *
 * 将来的にSQLite FTSへの移行も可能な抽象化設計
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── 型定義 ──────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  provider?: string;
  model?: string;
  branches?: ChatBranch[];
}

export interface ChatBranch {
  axis: 'logical' | 'practical' | 'critical';
  label: string;
  content: string;
  confidence: number;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  provider: string;
  model: string;
  messageCount: number;
}

export interface ChatSessionSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  provider: string;
  model: string;
  messageCount: number;
  preview: string;
}

// ─── ChatStore クラス ────────────────────────────────

export class ChatStore {
  private storeDir: string;
  private indexPath: string;
  private index: ChatSessionSummary[] = [];

  constructor(storeDir: string) {
    this.storeDir = path.join(storeDir, 'chat-history');
    this.indexPath = path.join(this.storeDir, '_index.json');
    this.ensureDir();
    this.loadIndex();
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.storeDir)) {
      fs.mkdirSync(this.storeDir, { recursive: true });
    }
  }

  private loadIndex(): void {
    try {
      if (fs.existsSync(this.indexPath)) {
        this.index = JSON.parse(fs.readFileSync(this.indexPath, 'utf-8'));
      }
    } catch {
      this.index = [];
    }
  }

  private saveIndex(): void {
    fs.writeFileSync(this.indexPath, JSON.stringify(this.index, null, 2), 'utf-8');
  }

  private sessionPath(sessionId: string): string {
    return path.join(this.storeDir, `${sessionId}.json`);
  }

  private generateId(): string {
    return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  // ─── セッション管理 ──────────────────────────────

  createSession(provider: string, model: string, title?: string): ChatSession {
    const session: ChatSession = {
      id: this.generateId(),
      title: title || `Chat ${new Date().toLocaleString('ja-JP')}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      provider,
      model,
      messageCount: 0,
    };

    fs.writeFileSync(this.sessionPath(session.id), JSON.stringify(session, null, 2), 'utf-8');

    this.index.unshift({
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      provider: session.provider,
      model: session.model,
      messageCount: 0,
      preview: '',
    });
    this.saveIndex();

    return session;
  }

  getSession(sessionId: string): ChatSession | null {
    try {
      const filePath = this.sessionPath(sessionId);
      if (!fs.existsSync(filePath)) return null;
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      return null;
    }
  }

  listSessions(limit: number = 50, offset: number = 0): ChatSessionSummary[] {
    return this.index.slice(offset, offset + limit);
  }

  deleteSession(sessionId: string): boolean {
    const filePath = this.sessionPath(sessionId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    const idx = this.index.findIndex(s => s.id === sessionId);
    if (idx >= 0) {
      this.index.splice(idx, 1);
      this.saveIndex();
      return true;
    }
    return false;
  }

  updateSessionTitle(sessionId: string, title: string): boolean {
    const session = this.getSession(sessionId);
    if (!session) return false;

    session.title = title;
    fs.writeFileSync(this.sessionPath(sessionId), JSON.stringify(session, null, 2), 'utf-8');

    const idx = this.index.findIndex(s => s.id === sessionId);
    if (idx >= 0) {
      this.index[idx].title = title;
      this.saveIndex();
    }
    return true;
  }

  // ─── メッセージ追加 ──────────────────────────────

  addMessage(sessionId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>): ChatMessage {
    const session = this.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const msg: ChatMessage = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
    };

    session.messages.push(msg);
    session.messageCount = session.messages.length;
    session.updatedAt = msg.timestamp;

    // タイトル自動生成（最初のユーザーメッセージから）
    if (session.messages.length === 1 && msg.role === 'user') {
      session.title = msg.content.slice(0, 50) + (msg.content.length > 50 ? '…' : '');
    }

    fs.writeFileSync(this.sessionPath(sessionId), JSON.stringify(session, null, 2), 'utf-8');

    // インデックス更新
    const idx = this.index.findIndex(s => s.id === sessionId);
    if (idx >= 0) {
      this.index[idx].updatedAt = msg.timestamp;
      this.index[idx].messageCount = session.messageCount;
      this.index[idx].title = session.title;
      this.index[idx].preview = msg.content.slice(0, 100);

      // 最新を先頭に移動
      if (idx > 0) {
        const item = this.index.splice(idx, 1)[0];
        this.index.unshift(item);
      }
      this.saveIndex();
    }

    return msg;
  }

  // ─── 検索 ────────────────────────────────────────

  searchMessages(query: string, limit: number = 20): Array<{
    sessionId: string;
    sessionTitle: string;
    message: ChatMessage;
  }> {
    const results: Array<{
      sessionId: string;
      sessionTitle: string;
      message: ChatMessage;
    }> = [];
    const lowerQuery = query.toLowerCase();

    for (const summary of this.index) {
      if (results.length >= limit) break;

      const session = this.getSession(summary.id);
      if (!session) continue;

      for (const msg of session.messages) {
        if (results.length >= limit) break;
        if (msg.content.toLowerCase().includes(lowerQuery)) {
          results.push({
            sessionId: session.id,
            sessionTitle: session.title,
            message: msg,
          });
        }
      }
    }

    return results;
  }

  // ─── 統計 ────────────────────────────────────────

  getStats(): {
    totalSessions: number;
    totalMessages: number;
    providers: Record<string, number>;
  } {
    const providers: Record<string, number> = {};
    let totalMessages = 0;

    for (const s of this.index) {
      totalMessages += s.messageCount;
      providers[s.provider] = (providers[s.provider] || 0) + 1;
    }

    return {
      totalSessions: this.index.length,
      totalMessages,
      providers,
    };
  }
}
