import { EventEmitter } from 'events';
import crypto from 'crypto';
import type {
  ApprovalPolicy,
  ApprovalRule,
  ApprovalQueueItem,
  ApprovalDecision,
  ApprovalAction,
  ApprovalPreset,
  ScheduledPolicy,
} from '@doublt/shared';
import type { JsonStore } from '../storage/JsonStore.js';

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

/** Parse "HH:MM-HH:MM" and check if current time is within range */
function isInTimeRange(timeRange: string): boolean {
  const match = timeRange.match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
  if (!match) return false;
  const [, sh, sm, eh, em] = match;
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  const start = parseInt(sh, 10) * 60 + parseInt(sm, 10);
  const end = parseInt(eh, 10) * 60 + parseInt(em, 10);
  // Handle overnight ranges (e.g., 22:00-06:00)
  if (start <= end) {
    return current >= start && current < end;
  }
  return current >= start || current < end;
}

export class ApprovalPolicyManager extends EventEmitter {
  private policies: Map<string, ApprovalPolicy> = new Map();
  private activePolicyId: string | null = null;
  private queue: ApprovalQueueItem[] = [];
  private sessionPolicies = new Map<string, string>(); // sessionId → policyId
  private scheduledPolicies: ScheduledPolicy[] = [];
  private scheduleTimer: ReturnType<typeof setInterval> | null = null;

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
    sessionId: string,
  ): { action: ApprovalAction; matchedRule?: ApprovalRule } {
    const policy = this.getEffectivePolicy(sessionId);
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

  // ─── Session Policy Overrides ──────────────────────────────

  /**
   * Set a per-session policy override.
   */
  setSessionPolicy(sessionId: string, policyId: string): void {
    if (!this.policies.has(policyId)) {
      throw new Error(`Policy ${policyId} not found`);
    }
    this.sessionPolicies.set(sessionId, policyId);
    this.emit('policy:updated', this.policies.get(policyId));
  }

  /**
   * Remove a session's policy override.
   */
  clearSessionPolicy(sessionId: string): void {
    this.sessionPolicies.delete(sessionId);
  }

  /**
   * Get the effective policy for a session.
   * Priority: session override > scheduled policy > active global policy.
   */
  getEffectivePolicy(sessionId?: string): ApprovalPolicy | null {
    // 1. Session override
    if (sessionId) {
      const overrideId = this.sessionPolicies.get(sessionId);
      if (overrideId) {
        const policy = this.policies.get(overrideId);
        if (policy) return policy;
      }
    }

    // 2. Scheduled policy (check if any time-based policy is active now)
    for (const sched of this.scheduledPolicies) {
      if (sched.enabled && isInTimeRange(sched.timeRange)) {
        const policy = this.policies.get(sched.policyId);
        if (policy) return policy;
      }
    }

    // 3. Active global policy
    return this.getActivePolicy();
  }

  /**
   * Check if a session is effectively in full_auto mode.
   */
  isFullAuto(sessionId?: string): boolean {
    const policy = this.getEffectivePolicy(sessionId);
    if (!policy) return false;
    // full_auto = single wildcard rule with auto_approve
    return policy.rules.length === 1
      && policy.rules[0].toolPattern === '*'
      && policy.rules[0].action === 'auto_approve';
  }

  // ─── Time-Based Scheduling ─────────────────────────────────

  /**
   * Schedule a policy to be active during a time range.
   * @param policyId - policy to activate
   * @param timeRange - "HH:MM-HH:MM" format (e.g., "22:00-06:00")
   */
  schedulePolicy(policyId: string, timeRange: string): ScheduledPolicy {
    if (!this.policies.has(policyId)) {
      throw new Error(`Policy ${policyId} not found`);
    }
    if (!/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(timeRange)) {
      throw new Error('timeRange must be in HH:MM-HH:MM format');
    }
    // Remove existing schedule for same policy
    this.scheduledPolicies = this.scheduledPolicies.filter(s => s.policyId !== policyId);
    const sched: ScheduledPolicy = { policyId, timeRange, enabled: true };
    this.scheduledPolicies.push(sched);
    this.ensureScheduleTimer();
    this.emit('policy:updated', this.policies.get(policyId));
    return sched;
  }

  /**
   * Remove a scheduled policy.
   */
  clearSchedule(policyId: string): void {
    this.scheduledPolicies = this.scheduledPolicies.filter(s => s.policyId !== policyId);
    if (this.scheduledPolicies.length === 0 && this.scheduleTimer) {
      clearInterval(this.scheduleTimer);
      this.scheduleTimer = null;
    }
  }

  /**
   * Get all scheduled policies.
   */
  listSchedules(): ScheduledPolicy[] {
    return [...this.scheduledPolicies];
  }

  /**
   * Start a 1-minute interval to check scheduled policies.
   */
  private ensureScheduleTimer(): void {
    if (this.scheduleTimer) return;
    this.scheduleTimer = setInterval(() => {
      // Emit event so server can re-evaluate active policy
      this.emit('schedule:tick');
    }, 60_000);
  }

  // ─── Toggle Preset ─────────────────────────────────────────

  /**
   * Toggle between conservative and full_auto presets.
   * Reuses existing policies if available; creates new ones only if needed.
   * Returns the newly active policy.
   */
  togglePreset(): ApprovalPolicy {
    const current = this.getActivePolicy();
    const targetPreset: ApprovalPreset = this.isFullAuto() ? 'conservative' : 'full_auto';

    // Find existing policy matching the target preset name
    const targetName = targetPreset === 'full_auto' ? 'Full Auto' : 'Conservative';
    for (const policy of this.policies.values()) {
      if (policy.name === targetName) {
        this.setActivePolicy(policy.id);
        return policy;
      }
    }

    // No existing policy found — create via preset
    return this.applyPreset(targetPreset);
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

  /**
   * Restore policies from persisted state.
   */
  restorePolicies(policies: ApprovalPolicy[]): void {
    for (const policy of policies) {
      this.policies.set(policy.id, { ...policy });
    }
  }

  /**
   * Debounced save of all policies + active policy ID to JsonStore.
   */
  save(store: JsonStore): void {
    store.scheduleSave('policies.json', {
      policies: this.listPolicies(),
      activePolicyId: this.activePolicyId,
    });
  }

  /**
   * Load policies from JsonStore and restore state (including active policy).
   */
  async load(store: JsonStore): Promise<boolean> {
    const data = await store.load<{ policies: ApprovalPolicy[]; activePolicyId?: string | null } | ApprovalPolicy[]>('policies.json');
    if (!data) return false;

    // Support both old format (plain array) and new format ({ policies, activePolicyId })
    if (Array.isArray(data)) {
      if (data.length) {
        this.restorePolicies(data);
        return true;
      }
      return false;
    }

    if (data.policies?.length) {
      this.restorePolicies(data.policies);
      if (data.activePolicyId && this.policies.has(data.activePolicyId)) {
        this.activePolicyId = data.activePolicyId;
      }
      return true;
    }
    return false;
  }

  /**
   * Clean up timers. Used during server shutdown.
   */
  destroy(): void {
    if (this.scheduleTimer) {
      clearInterval(this.scheduleTimer);
      this.scheduleTimer = null;
    }
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
