/**
 * Rei-AIOS テーマI — KnowledgeWindowManager
 * 数学知識ネットワーク統合ウィンドウの生成・IPC管理。
 * arXiv / OEIS / 数式シミュレーター / D-FUMTエンジン を統合する。
 */

import { BrowserWindow, ipcMain, screen } from 'electron';
import * as path from 'path';
import {
  KNOWLEDGE_IPC, KnowledgeState,
  ArxivFetchOptions, OeisSearchOptions,
  EducationValueParams, MonetizationParams, NetworkParams,
} from './types';
import { ArxivFetcher, makeDefaultArxivState }   from './arxiv-fetcher';
import { OeisFetcher,  makeDefaultOeisState  }   from './oeis-fetcher';
import { mathSimulator }                          from './math-simulator';
import { DFUMTEngine }                            from '../../core/engine';

export class KnowledgeWindowManager {
  private win:           BrowserWindow | null = null;
  private mainWin:       BrowserWindow;
  private arxiv:         ArxivFetcher;
  private oeis:          OeisFetcher;
  private dfumt:         DFUMTEngine;
  private state:         KnowledgeState;
  private readonly PRELOAD_PATH: string;
  private readonly HTML_PATH:    string;

  constructor(mainWindow: BrowserWindow) {
    this.mainWin      = mainWindow;
    this.arxiv        = new ArxivFetcher();
    this.oeis         = new OeisFetcher();
    this.dfumt        = new DFUMTEngine();
    this.PRELOAD_PATH = path.join(__dirname, 'preload-knowledge.js');
    this.HTML_PATH    = path.join(__dirname, '../../src/aios/knowledge/knowledge.html');
    this.state = {
      arxiv:            makeDefaultArxivState(),
      oeis:             makeDefaultOeisState(),
      sim:              null,
      lastDfumtSummary: '未実行',
      updatedAt:        0,
    };
  }

  registerIpcHandlers(): void {
    ipcMain.handle(KNOWLEDGE_IPC.OPEN,  async () => { await this.open(); return { ok: true }; });
    ipcMain.handle(KNOWLEDGE_IPC.CLOSE, ()        => { this.close();      return { ok: true }; });

    ipcMain.on(KNOWLEDGE_IPC.READY, () => {
      this._send(KNOWLEDGE_IPC.STATE_UPDATE, this.state);
    });

    // ── arXiv ──
    ipcMain.handle(KNOWLEDGE_IPC.FETCH_ARXIV, async (_e, opts: ArxivFetchOptions) => {
      this.state.arxiv.isLoading = true;
      this._send(KNOWLEDGE_IPC.STATE_UPDATE, this.state);
      try {
        const papers = await this.arxiv.fetch(opts);
        this.state.arxiv = {
          papers, query: opts.query,
          fetchedAt: Date.now(), isLoading: false,
        };
      } catch (e: any) {
        this.state.arxiv.isLoading = false;
        this.state.arxiv.error = e.message;
      }
      this.state.updatedAt = Date.now();
      this._send(KNOWLEDGE_IPC.STATE_UPDATE, this.state);
      return this.state.arxiv;
    });

    // ── OEIS ──
    ipcMain.handle(KNOWLEDGE_IPC.FETCH_OEIS, async (_e, opts: OeisSearchOptions) => {
      this.state.oeis.isLoading = true;
      this._send(KNOWLEDGE_IPC.STATE_UPDATE, this.state);
      try {
        const sequences = await this.oeis.search(opts);
        this.state.oeis = {
          sequences, query: opts.query,
          fetchedAt: Date.now(), isLoading: false,
        };
      } catch (e: any) {
        this.state.oeis.isLoading = false;
        this.state.oeis.error = e.message;
      }
      this.state.updatedAt = Date.now();
      this._send(KNOWLEDGE_IPC.STATE_UPDATE, this.state);
      return this.state.oeis;
    });

    // ── 数式シミュレーター ──
    ipcMain.handle(KNOWLEDGE_IPC.RUN_SIM, (_e, params: {
      edu?: EducationValueParams; mon?: MonetizationParams; net?: NetworkParams;
    }) => {
      const result = mathSimulator.runTimeline(params.edu, params.mon, params.net);
      this.state.sim = result;
      this.state.updatedAt = Date.now();
      this._send(KNOWLEDGE_IPC.STATE_UPDATE, this.state);
      return result;
    });

    // ── D-FUMTエンジン連携 ──
    ipcMain.handle(KNOWLEDGE_IPC.RUN_DFUMT, (_e, vector: number[]) => {
      try {
        const result = this.dfumt.run(vector, {
          expansionDepth: 3, evolutionGenerations: 4, synthesisMode: 'dual',
        });
        this.state.lastDfumtSummary = result.summary;
        this.state.updatedAt = Date.now();
        this._send(KNOWLEDGE_IPC.STATE_UPDATE, this.state);
        return {
          summary:    result.summary,
          survivors:  result.selection.finalSurvivors.length,
          energy:     result.metabolism.formulas.at(-1)?.energy    ?? 0,
          complexity: result.metabolism.formulas.at(-1)?.complexity ?? 0,
          fitness:    result.selection.finalSurvivors[0]?.fitness   ?? 0,
        };
      } catch (e: any) {
        return { error: e.message };
      }
    });
  }

  async open(): Promise<void> {
    if (this.win && !this.win.isDestroyed()) { this.win.focus(); return; }
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    const mb = this.mainWin.getBounds();
    this.win = new BrowserWindow({
      width:  Math.min(1280, width - 60),
      height: Math.min(820, height - 60),
      x: Math.max(0, mb.x + 60),
      y: Math.max(0, mb.y + 60),
      frame: false,
      titleBarStyle: 'hidden',
      backgroundColor: '#06060b',
      resizable: true, movable: true,
      title: 'Knowledge Network — Rei-AIOS',
      webPreferences: {
        preload: this.PRELOAD_PATH,
        contextIsolation: true, nodeIntegration: false,
        sandbox: false, webSecurity: true,
      },
    });
    this.win.loadFile(this.HTML_PATH);
    this.win.on('closed', () => {
      this.win = null;
      this.mainWin.webContents.send(KNOWLEDGE_IPC.CLOSED);
    });
  }

  close(): void {
    if (this.win && !this.win.isDestroyed()) this.win.close();
    this.win = null;
  }

  isOpen(): boolean { return !!this.win && !this.win.isDestroyed(); }

  private _send(ch: string, d: unknown): void {
    if (this.win && !this.win.isDestroyed())
      this.win.webContents.send(ch, d);
  }
}
