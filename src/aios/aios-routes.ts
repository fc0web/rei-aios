/**
 * Rei AIOS — API Routes
 * AIアシスタント用REST APIエンドポイント
 *
 * POST /api/aios/chat            — チャット送信
 * GET  /api/aios/sessions        — セッション一覧
 * GET  /api/aios/sessions/:id    — セッション詳細
 * DELETE /api/aios/sessions/:id  — セッション削除
 * PUT  /api/aios/sessions/:id    — セッション名変更
 * GET  /api/aios/providers       — プロバイダー一覧
 * PUT  /api/aios/providers/:id   — プロバイダー設定更新
 * POST /api/aios/providers/:id/test — プロバイダー接続テスト
 * PUT  /api/aios/active-provider — アクティブプロバイダー変更
 * GET  /api/aios/search          — チャット検索
 * GET  /api/aios/stats           — 統計情報
 */

import * as http from 'http';
import { AIOSEngine, ChatRequest } from './aios-engine';

// ─── ヘルパー ────────────────────────────────────────

function jsonResponse(res: http.ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function readBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: string) => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// ─── ルート定義 ──────────────────────────────────────

interface AIOSRouteHandler {
  method: string;
  pattern: RegExp;
  handler: (
    req: http.IncomingMessage,
    res: http.ServerResponse,
    params: Record<string, string>
  ) => Promise<void>;
}

export function createAIOSRoutes(engine: AIOSEngine): AIOSRouteHandler[] {
  return [
    // ── チャット ─────────────────────────────────
    {
      method: 'POST',
      pattern: /^\/api\/aios\/chat$/,
      handler: async (req, res) => {
        try {
          const body = await readBody(req);
          const request: ChatRequest = {
            message: body.message,
            sessionId: body.sessionId,
            provider: body.provider,
            model: body.model,
            enableBranching: body.enableBranching,
            systemPrompt: body.systemPrompt,
            temperature: body.temperature,
          };

          if (!request.message) {
            jsonResponse(res, 400, { error: 'message is required' });
            return;
          }

          const result = await engine.chat(request);
          jsonResponse(res, 200, result);
        } catch (e: any) {
          jsonResponse(res, 500, { error: e.message });
        }
      },
    },

    // ── セッション管理 ───────────────────────────
    {
      method: 'GET',
      pattern: /^\/api\/aios\/sessions$/,
      handler: async (_req, res) => {
        const sessions = engine.getSessions(50);
        jsonResponse(res, 200, { sessions });
      },
    },
    {
      method: 'GET',
      pattern: /^\/api\/aios\/sessions\/(?<id>[^/]+)$/,
      handler: async (_req, res, params) => {
        const session = engine.getSession(params.id);
        if (!session) {
          jsonResponse(res, 404, { error: 'Session not found' });
          return;
        }
        jsonResponse(res, 200, session);
      },
    },
    {
      method: 'DELETE',
      pattern: /^\/api\/aios\/sessions\/(?<id>[^/]+)$/,
      handler: async (_req, res, params) => {
        const deleted = engine.deleteSession(params.id);
        jsonResponse(res, 200, { deleted });
      },
    },
    {
      method: 'PUT',
      pattern: /^\/api\/aios\/sessions\/(?<id>[^/]+)$/,
      handler: async (req, res, params) => {
        const body = await readBody(req);
        if (!body.title) {
          jsonResponse(res, 400, { error: 'title is required' });
          return;
        }
        const updated = engine.renameSession(params.id, body.title);
        jsonResponse(res, 200, { updated });
      },
    },

    // ── プロバイダー管理 ─────────────────────────
    {
      method: 'GET',
      pattern: /^\/api\/aios\/providers$/,
      handler: async (_req, res) => {
        const providers = engine.getProviders();
        const active = engine.getActiveProvider();
        jsonResponse(res, 200, { providers, activeProvider: active });
      },
    },
    {
      method: 'PUT',
      pattern: /^\/api\/aios\/providers\/(?<id>[^/]+)$/,
      handler: async (req, res, params) => {
        try {
          const body = await readBody(req);
          engine.updateProvider(params.id, body);
          jsonResponse(res, 200, { success: true });
        } catch (e: any) {
          jsonResponse(res, 400, { error: e.message });
        }
      },
    },
    {
      method: 'POST',
      pattern: /^\/api\/aios\/providers\/(?<id>[^/]+)\/test$/,
      handler: async (_req, res, params) => {
        try {
          const status = await engine.testProvider(params.id);
          jsonResponse(res, 200, status);
        } catch (e: any) {
          jsonResponse(res, 500, { error: e.message });
        }
      },
    },

    // Ollamaなど：動的モデル一覧取得
    {
      method: 'GET',
      pattern: /^\/api\/aios\/providers\/(?<id>[^/]+)\/models$/,
      handler: async (_req, res, params) => {
        try {
          const models = await engine.listProviderModels(params.id);
          jsonResponse(res, 200, { models });
        } catch (e: any) {
          jsonResponse(res, 500, { error: e.message });
        }
      },
    },
    {
      method: 'PUT',
      pattern: /^\/api\/aios\/active-provider$/,
      handler: async (req, res) => {
        try {
          const body = await readBody(req);
          engine.setActiveProvider(body.providerId);
          jsonResponse(res, 200, { activeProvider: body.providerId });
        } catch (e: any) {
          jsonResponse(res, 400, { error: e.message });
        }
      },
    },

    // ── 検索・統計 ───────────────────────────────
    {
      method: 'GET',
      pattern: /^\/api\/aios\/search$/,
      handler: async (req, res) => {
        const url = new URL(req.url || '', 'http://localhost');
        const query = url.searchParams.get('q') || '';
        if (!query) {
          jsonResponse(res, 400, { error: 'q parameter is required' });
          return;
        }
        const results = engine.searchChats(query);
        jsonResponse(res, 200, { results });
      },
    },
    {
      method: 'GET',
      pattern: /^\/api\/aios\/stats$/,
      handler: async (_req, res) => {
        const stats = engine.getChatStats();
        jsonResponse(res, 200, stats);
      },
    },
  ];
}
