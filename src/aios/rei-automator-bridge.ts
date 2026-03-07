/**
 * ReiAutomatorBridge — 公理推論 → PC行動 変換ブリッジ
 *
 * DependentOrigination / TheoremDeriver の推論結果を
 * ActionExecutor（rei-automator）の行動コマンドに変換する。
 *
 * 「考えて→行動するループ」の実装:
 *   1. TheoremDeriver が定理を導出
 *   2. ReiTaskQueue にタスクとして登録
 *   3. ReiAutomatorBridge が行動コマンドに変換
 *   4. ActionExecutor が実行
 *   5. 結果を RuntimeBus に返す（フィードバックループ）
 *
 * 安全設計:
 *   - autoExecute: false がデフォルト（手動承認が必要）
 *   - allowedActions で許可アクションを明示的に指定
 *   - 全行動をログに記録
 *
 * @author Nobuki Fujimoto (D-FUMT) + Claude
 */

import * as fs   from 'fs';
import * as path from 'path';
import { ReiTaskQueue } from '../axiom-os/rei-task-queue';
import { TheoremDeriver, type Theorem } from '../axiom-os/theorem-deriver';
import { type SevenLogicValue } from '../axiom-os/seven-logic';
import { getReiAIOSRuntime } from './rei-aios-runtime-bus';
import { ActionExecutor } from './action-executor';

// ── 型定義 ────────────────────────────────────────────────

export type ActionKind =
  | 'file_write'     // ファイル書き込み
  | 'file_read'      // ファイル読み込み
  | 'shell_command'  // シェルコマンド実行（要許可）
  | 'note_export'    // note.com 記事エクスポート
  | 'proof_run'      // 形式証明の実行
  | 'axiom_propose'  // 公理の提案
  | 'report';        // レポート生成

export interface ReiBridgeAction {
  id: string;
  kind: ActionKind;
  label: string;                // 人間可読な説明
  command: string;              // ActionExecutor に渡すコマンド
  sourceTheorem?: string;       // 根拠となった定理ID
  logicBasis: string;           // 七価論理的根拠
  approved: boolean;            // 藤本さんの承認フラグ
  result?: string;
  executedAt?: number;
}

export interface BridgeConfig {
  autoExecute: boolean;         // false: 承認待ち、true: 自動実行
  allowedActions: ActionKind[]; // 許可するアクション種別
  logDir: string;               // 実行ログの保存先
}

// ── ReiAutomatorBridge ────────────────────────────────────

export class ReiAutomatorBridge {
  private queue: ReiTaskQueue;
  private deriver: TheoremDeriver;
  private pendingActions: Map<string, ReiBridgeAction> = new Map();
  private executedLog: ReiBridgeAction[] = [];
  private config: BridgeConfig;
  private idCounter = 0;
  private executor: ActionExecutor;

  constructor(config?: Partial<BridgeConfig>) {
    this.config = {
      autoExecute:    false,   // デフォルト: 手動承認
      allowedActions: ['file_write', 'file_read', 'note_export', 'proof_run', 'report'],
      logDir:         'data/automator-log',
      ...config,
    };
    this.queue    = ReiTaskQueue.getInstance();
    this.deriver  = new TheoremDeriver();
    this.executor = new ActionExecutor({ dryRun: true }); // デフォルトはdryRun

    fs.mkdirSync(this.config.logDir, { recursive: true });
  }

  // ── 推論結果 → 行動提案 ──────────────────────────────

  proposeFromTheorems(category: string): ReiBridgeAction[] {
    const system = this.deriver.deriveSystem(category, 2);
    const actions: ReiBridgeAction[] = [];

    for (const theorem of system.theorems.slice(0, 5)) {
      const action = this._theoremToAction(theorem);
      if (action) {
        this.pendingActions.set(action.id, action);
        actions.push(action);
      }
    }
    return actions;
  }

  private _theoremToAction(theorem: Theorem): ReiBridgeAction | null {
    const id = `action-${++this.idCounter}-${Date.now()}`;

    // 論理カテゴリ → 形式証明の実行
    if (theorem.derivedFrom.some(p => p.includes('catuskoti') || p.includes('logic'))) {
      return {
        id, kind: 'proof_run',
        label: `定理「${theorem.proof}」の形式証明を実行`,
        command: `rei-proof run "${theorem.derivedFrom.join(' ∧ ')}"`,
        sourceTheorem: theorem.proof,
        logicBasis: `${theorem.logicValue}: ${theorem.derivedFrom.join(' + ')}から導出`,
        approved: false,
      };
    }

    // 知識カテゴリ → レポート生成
    if (theorem.derivedFrom.some(p => p.includes('consciousness') || p.includes('ai'))) {
      return {
        id, kind: 'report',
        label: `「${theorem.proof}」に関するレポートを生成`,
        command: `rei-report generate "${theorem.proof}"`,
        sourceTheorem: theorem.proof,
        logicBasis: `${theorem.logicValue}`,
        approved: false,
      };
    }

    // 数学カテゴリ → note記事エクスポート候補
    if (theorem.derivedFrom.some(p => p.includes('spiral') || p.includes('entropy'))) {
      return {
        id, kind: 'note_export',
        label: `「${theorem.proof}」をnote記事の素材としてエクスポート`,
        command: `rei-export note "${theorem.proof}"`,
        sourceTheorem: theorem.proof,
        logicBasis: `${theorem.logicValue}`,
        approved: false,
      };
    }

    return null;
  }

  // ── 行動承認 ──────────────────────────────────────────

  approve(actionId: string): void {
    const action = this.pendingActions.get(actionId);
    if (action) {
      action.approved = true;
      if (this.config.allowedActions.includes(action.kind)) {
        this._enqueueExecution(action);
      }
    }
  }

  private _enqueueExecution(action: ReiBridgeAction): void {
    this.queue.enqueue({
      name: action.label,
      category: action.kind,
      priority: 5,
      timeoutMs: 30000,
      maxRetries: 1,
      payload: action,
      fn: async () => {
        return await this._execute(action);
      },
    });
  }

  private async _execute(action: ReiBridgeAction): Promise<string> {
    action.executedAt = Date.now();

    let result = '';

    if (action.kind === 'shell_command') {
      // ActionExecutor 経由で実行
      const res = await this.executor.execute(action.command);
      result = res.success ? 'ok' : `error: ${res.error ?? res.rejectionReason}`;
    } else {
      result = await this._localExecute(action);
    }

    action.result = result;
    this.pendingActions.delete(action.id);
    this.executedLog.push(action);
    this._saveLog();

    // RuntimeBus にフィードバック
    try {
      const bus = getReiAIOSRuntime();
      bus.publish({
        type: 'inference',
        payload: {
          question: action.label,
          depth: 1,
          axiomIds: [action.kind],
          logicValues: ['TRUE' as SevenLogicValue],
          result: 'TRUE' as SevenLogicValue,
        },
        source: 'ReiAutomatorBridge',
        timestamp: Date.now(),
      });
    } catch { /* 無視 */ }

    return result;
  }

  private async _localExecute(action: ReiBridgeAction): Promise<string> {
    switch (action.kind) {
      case 'note_export': {
        const outPath = path.join(this.config.logDir, `note-${action.id}.md`);
        fs.writeFileSync(outPath, `# ${action.label}\n\n${action.logicBasis}\n\n生成日時: ${new Date().toISOString()}\n`);
        return `エクスポート完了: ${outPath}`;
      }
      case 'report': {
        const outPath = path.join(this.config.logDir, `report-${action.id}.md`);
        fs.writeFileSync(outPath, `# レポート: ${action.label}\n\n論理根拠: ${action.logicBasis}\n`);
        return `レポート生成完了: ${outPath}`;
      }
      case 'proof_run':
        return `形式証明タスク登録: ${action.command}`;
      default:
        return `実行済み: ${action.command}`;
    }
  }

  // ── 状態確認 ─────────────────────────────────────────

  getPendingActions(): ReiBridgeAction[] { return [...this.pendingActions.values()]; }
  getExecutedLog(limit = 20): ReiBridgeAction[] { return this.executedLog.slice(-limit); }

  private _saveLog(): void {
    const logPath = path.join(this.config.logDir, 'execution-log.json');
    fs.writeFileSync(logPath, JSON.stringify(this.executedLog, null, 2));
  }
}
