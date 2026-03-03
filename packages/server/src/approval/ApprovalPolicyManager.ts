import { EventEmitter } from 'events';
import crypto from 'crypto';
import type {
  ApprovalPolicy,
  ApprovalRule,
  ApprovalQueueItem,
  ApprovalDecision,
  ApprovalAction,
  ApprovalPreset,
} from '@doublt/shared';

function generateId(): string {
  return crypto.randomUUID().slice(0, 8);
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regexStr = escaped.replace(/\*/g, '.*');
  return new RegExp(`^${regexStr}$`, 'i');
}

function matchesPattern(toolName: string, pattern: string): boolean {
  return globToRegex(pattern).test(toolName);
}

function getRiskLevel(toolName: string): 'low' | 'medium' | 'high' {
  const lower = toolName.toLowerCase();
  if (/write|delete|remove/.test(lower)) return 'high';
  if (/exec|shell|command/.test(lower)) return 'high';
  if (/read|list|search/.test(lower)) return 'low';
  return 'medium';
}

export class ApprovalPolicyManager extends EventEmitter {
  private policies: Map<string, ApprovalPolicy> = new Map();
  private activePolicyId: string | null = null;
  private queue: ApprovalQueueItem[] = [];

  createPolicy(
    name: string,
    description: string,
    rules: Omit<ApprovalRule, 'id'>[],
  ): ApprovalPolicy {
    const now = Date.now();
    const policy: ApprovalPolicy = {
      id: generateId(),
      name,
      description,
      rules: rules.map(r => ({ ...r, id: generateId() })),
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };
    this.policies.set(policy.id, policy);
    this.emit('policy:updated', policy);
    return policy;
  }

  updatePolicy(
    id: string,
    updates: Partial<Pick<ApprovalPolicy, 'name' | 'description' | 'rules' | 'enabled'>>,
  ): ApprovalPolicy | null {
    const existing = this.policies.get(id);
    if (!existing) return null;
    const updated: ApprovalPolicy = {
      ...existing,
      ...updates,
      rules: updates.rules
        ? updates.rules.map((r: ApprovalRule) => ({ ...r, id: r.id ?? generateId() }))
        : existing.rules,
      updatedAt: Date.now(),
    };
    this.policies.set(id, updated);
    this.emit('policy:updated', updated);
    return updated;
  }

  deletePolicy(id: string): boolean {
    const existed = this.policies.has(id);
    if (existed) {
      this.policies.delete(id);
      if (this.activePolicyId === id) this.activePolicyId = null;
      this.emit('policy:updated', null);
    }
    return existed;
  }

  listPolicies(): ApprovalPolicy[] {
    return Array.from(this.policies.values());
  }

  getActivePolicy(): ApprovalPolicy | null {
    if (!this.activePolicyId) return null;
    return this.policies.get(this.activePolicyId) ?? null;
  }

  setActivePolicy(id: string): void {
    if (!this.policies.has(id)) {
      throw new Error(`Policy ${id} not found`);
    }
    this.activePolicyId = id;
    this.emit('policy:updated', this.policies.get(id));
  }

  evaluateToolUse(
    toolName: string,
    _input: Record<string, unknown>,
    _sessionId: string,
  ): { action: ApprovalAction; matchedRule?: ApprovalRule } {
    const policy = this.getActivePolicy();
    if (!policy || !policy.enabled) {
      return { action: 'require_confirm' };
    }
    for (const rule of policy.rules) {
      if (matchesPattern(toolName, rule.toolPattern)) {
        return { action: rule.action, matchedRule: rule };
      }
    }
    return { action: 'require_confirm' };
  }

  enqueueApproval(
    sessionId: string,
    toolName: string,
    input: Record<string, unknown>,
  ): ApprovalQueueItem {
    const item: ApprovalQueueItem = {
      id: generateId(),
      sessionId,
      toolName,
      input,
      riskLevel: getRiskLevel(toolName),
      createdAt: Date.now(),
      status: 'pending',
    };
    this.queue.push(item);
    this.emit('approval:needed', item);
    return item;
  }

  listPendingApprovals(): ApprovalQueueItem[] {
    return this.queue.filter(item => item.status === 'pending');
  }

  decideApproval(
    queueItemId: string,
    approved: boolean,
    decidedBy: string,
    reason?: string,
  ): ApprovalDecision | null {
    const item = this.queue.find(i => i.id === queueItemId);
    if (!item || item.status !== 'pending') return null;
    item.status = approved ? 'approved' : 'denied';
    const decision: ApprovalDecision = {
      queueItemId,
      approved,
      reason,
      decidedBy,
      decidedAt: Date.now(),
    };
    this.emit('approval:decided', decision);
    return decision;
  }

  applyPreset(preset: ApprovalPreset): ApprovalPolicy {
    let name: string;
    let description: string;
    let rules: Omit<ApprovalRule, 'id'>[];

    switch (preset) {
      case 'conservative':
        name = 'Conservative';
        description = 'Auto-approve reads; require confirmation for everything else.';
        rules = [
          { toolPattern: 'read', action: 'auto_approve' },
          { toolPattern: 'list', action: 'auto_approve' },
          { toolPattern: 'search', action: 'auto_approve' },
          { toolPattern: '*', action: 'require_confirm' },
        ];
        break;

      case 'moderate':
        name = 'Moderate';
        description =
          'Auto-approve safe ops; confirm writes/edits; block destructive/exec ops.';
        rules = [
          { toolPattern: 'read', action: 'auto_approve' },
          { toolPattern: 'list', action: 'auto_approve' },
          { toolPattern: 'search', action: 'auto_approve' },
          { toolPattern: 'build', action: 'auto_approve' },
          { toolPattern: 'test', action: 'auto_approve' },
          { toolPattern: 'lint', action: 'auto_approve' },
          { toolPattern: 'write', action: 'require_confirm' },
          { toolPattern: 'edit', action: 'require_confirm' },
          { toolPattern: 'delete', action: 'block' },
          { toolPattern: 'remove', action: 'block' },
          { toolPattern: 'exec', action: 'block' },
          { toolPattern: 'shell', action: 'block' },
        ];
        break;

      case 'permissive':
        name = 'Permissive';
        description = 'Auto-approve everything; require confirmation only for destructive ops.';
        rules = [
          { toolPattern: 'delete', action: 'require_confirm' },
          { toolPattern: 'remove', action: 'require_confirm' },
          { toolPattern: '*', action: 'auto_approve' },
        ];
        break;

      case 'full_auto':
        name = 'Full Auto';
        description = 'Auto-approve ALL operations. For --dangerously-skip-permissions 24/7 mode.';
        rules = [
          { toolPattern: '*', action: 'auto_approve' },
        ];
        break;

      default:
        throw new Error(`Unknown preset: ${preset as string}`);
    }

    const policy = this.createPolicy(name, description, rules);
    this.setActivePolicy(policy.id);
    return policy;
  }
}
