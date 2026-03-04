/**
 * AxiomACL — 公理ベースアクセス制御エンジン
 *
 * D-FUMT設計思想：
 *   セキュリティルールを自然言語や手続きではなく
 *   「公理」として定義し、七価論理で評価する。
 *
 * 七価論理とACLの対応：
 *   ⊤ = アクセス許可（確定）
 *   ⊥ = アクセス拒否（確定）
 *   both = 矛盾するルールあり（管理者確認要）
 *   neither = 該当ルールなし（デフォルト拒否）
 *   ∞ = 評価不能（循環参照・無限ルール）
 *   〇 = 未定義（初期状態、ルール未設定）
 *   ～ = 条件付き許可（FLOWINGの条件が成立次第）
 *
 * 設計原則：
 *   - ルールは公理IDと七価論理で宣言する
 *   - 複数ルールの合成は七価論理の∧/∨で評価
 *   - 不可逆公理（irreversible）に違反する操作は常に拒否
 *   - 監査ログを全操作に記録する
 */

import { type SevenLogicValue, and, or, toSymbol } from './seven-logic';
import { SEED_KERNEL } from './seed-kernel';

// ── ACLルール ──

export interface AclRule {
  id: string;                    // ルールID
  axiomId: string;               // 根拠となる公理ID
  subject: string;               // 主体（ユーザー・ロール・エージェント）
  resource: string;              // リソース（操作対象）
  action: string;                // 操作（read/write/execute/delete）
  permission: SevenLogicValue;   // 許可値（七価論理）
  priority: number;              // 優先度（高いほど優先）
  irreversible: boolean;         // 不可逆ルール（違反は常に⊥）
  condition?: string;            // 条件（自然言語）
  expiresAt?: number;            // 有効期限（UNIXタイムスタンプ）
}

// ── アクセス評価結果 ──

export interface AclDecision {
  subject: string;
  resource: string;
  action: string;
  decision: SevenLogicValue;     // 最終判断
  appliedRules: AclRule[];       // 適用されたルール
  reasoning: string;             // 判断の根拠（公理チェーン）
  auditId: string;               // 監査ログID
  timestamp: number;
}

// ── 監査ログ ──

export interface AuditEntry {
  id: string;
  decision: AclDecision;
  granted: boolean;              // 実際に許可されたか
}

// ── AxiomACL 本体 ──

export class AxiomACL {
  private readonly rules: Map<string, AclRule> = new Map();
  private readonly auditLog: AuditEntry[] = [];
  private ruleCounter = 0;
  private auditCounter = 0;

  /**
   * ACLルールを追加する
   * axiomId で根拠となる公理を紐付ける
   */
  addRule(rule: Omit<AclRule, 'id'>): AclRule {
    const id = `acl-${++this.ruleCounter}`;
    const full: AclRule = { id, ...rule };
    this.rules.set(id, full);
    return full;
  }

  /**
   * 不可逆ルールを追加する（削除・書き換え禁止）
   * D-FUMT「不可逆性公理」に基づく最強の保護
   */
  addIrreversibleRule(
    subject: string,
    resource: string,
    action: string,
    axiomId = 'dfumt-idempotency',
  ): AclRule {
    return this.addRule({
      axiomId,
      subject,
      resource,
      action,
      permission: 'FALSE',       // 不可逆=常に拒否
      priority: 999,             // 最高優先度
      irreversible: true,
      condition: '不可逆性公理により永続的に拒否',
    });
  }

  /**
   * アクセスを評価する（メインAPI）
   */
  evaluate(
    subject: string,
    resource: string,
    action: string,
  ): AclDecision {
    const matched = this.matchRules(subject, resource, action);
    const decision = this.resolvePermission(matched);
    const reasoning = this.buildReasoning(matched, decision);
    const auditId = `audit-${++this.auditCounter}`;

    const result: AclDecision = {
      subject, resource, action,
      decision,
      appliedRules: matched,
      reasoning,
      auditId,
      timestamp: Date.now(),
    };

    // 監査ログに記録
    this.auditLog.push({
      id: auditId,
      decision: result,
      granted: decision === 'TRUE' || decision === 'FLOWING',
    });

    return result;
  }

  /**
   * アクセスを許可するか判断する（簡易API）
   * ⊤ or ～（条件付き）= 許可
   * それ以外 = 拒否
   */
  isGranted(subject: string, resource: string, action: string): boolean {
    const d = this.evaluate(subject, resource, action);
    return d.decision === 'TRUE' || d.decision === 'FLOWING';
  }

  /**
   * 公理違反チェック
   * 操作が特定の公理に違反する場合は即座に拒否
   */
  checkAxiomViolation(
    action: string,
    axiomId: string,
  ): { violated: boolean; axiomText: string; decision: SevenLogicValue } {
    const axiom = SEED_KERNEL.find(s => s.id === axiomId);
    const axiomText = axiom?.axiom ?? axiomId;

    // 不可逆公理（冪等性・収束）への違反チェック
    const irreversibleAxioms = [
      'dfumt-idempotency',
      'dfumt-zero-state',
      'dfumt-catuskoti',
    ];
    const violated = irreversibleAxioms.includes(axiomId) &&
      ['delete', 'overwrite', 'reset'].includes(action);

    return {
      violated,
      axiomText,
      decision: violated ? 'FALSE' : 'FLOWING',
    };
  }

  /** 全ルールを取得 */
  getRules(): AclRule[] {
    return [...this.rules.values()];
  }

  /** 特定ルールを取得 */
  getRule(id: string): AclRule | undefined {
    return this.rules.get(id);
  }

  /** ルールを削除（不可逆ルールは削除不可） */
  removeRule(id: string): boolean {
    const rule = this.rules.get(id);
    if (!rule) return false;
    if (rule.irreversible) return false; // 不可逆ルールは削除不可
    this.rules.delete(id);
    return true;
  }

  /** 監査ログを取得 */
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }

  /** ACLサマリー */
  summarize(): {
    totalRules: number;
    irreversibleRules: number;
    auditEntries: number;
    grantRate: number;
  } {
    const irreversible = [...this.rules.values()].filter(r => r.irreversible).length;
    const granted = this.auditLog.filter(e => e.granted).length;
    return {
      totalRules: this.rules.size,
      irreversibleRules: irreversible,
      auditEntries: this.auditLog.length,
      grantRate: this.auditLog.length > 0 ? granted / this.auditLog.length : 0,
    };
  }

  // ── プライベートメソッド ──

  private matchRules(
    subject: string,
    resource: string,
    action: string,
  ): AclRule[] {
    const now = Date.now();
    return [...this.rules.values()]
      .filter(r => {
        const subjectMatch = r.subject === subject || r.subject === '*';
        const resourceMatch = r.resource === resource || r.resource === '*';
        const actionMatch = r.action === action || r.action === '*';
        const notExpired = !r.expiresAt || r.expiresAt > now;
        return subjectMatch && resourceMatch && actionMatch && notExpired;
      })
      .sort((a, b) => b.priority - a.priority); // 優先度の高い順
  }

  private resolvePermission(rules: AclRule[]): SevenLogicValue {
    if (rules.length === 0) return 'NEITHER'; // ルールなし = neither（デフォルト拒否）

    // 不可逆ルールが1つでもあれば即座に⊥
    if (rules.some(r => r.irreversible && r.permission === 'FALSE')) return 'FALSE';

    // 最高優先度のルールから順に評価
    // 複数ルールを∧で合成（最も厳しい判断）
    let result: SevenLogicValue = rules[0].permission;
    for (let i = 1; i < rules.length; i++) {
      result = and(result, rules[i].permission);
    }
    return result;
  }

  private buildReasoning(rules: AclRule[], decision: SevenLogicValue): string {
    if (rules.length === 0) {
      return `ルール未定義: デフォルト拒否 → ${toSymbol('NEITHER')}`;
    }
    const ruleDescs = rules.map(r =>
      `  [${r.id}] 公理:${r.axiomId} → ${toSymbol(r.permission)}`
      + (r.irreversible ? '（不可逆）' : '')
    ).join('\n');
    return `適用ルール（${rules.length}件）:\n${ruleDescs}\n最終判断: ${toSymbol(decision)}`;
  }
}
