/**
 * CostTracker — Tracks token usage and estimated costs per session.
 *
 * Records token usage events, groups by session and day, checks budget
 * limits, and fires events when thresholds are crossed.
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import type {
  TokenUsage,
  CostEstimate,
  UsageSummary,
  BudgetAlert,
  BudgetConfig,
} from '@doublt/shared';

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-3-opus':    { input: 15.0,  output: 75.0  },
  'claude-3-sonnet':  { input: 3.0,   output: 15.0  },
  'claude-3-haiku':   { input: 0.25,  output: 1.25  },
  'claude-3.5-sonnet':{ input: 3.0,   output: 15.0  },
  'claude-3.5-haiku': { input: 0.8,   output: 4.0   },
  'default':          { input: 3.0,   output: 15.0  },
};

interface UsageRecord {
  sessionId: string;
  sessionName: string;
  usage: TokenUsage;
  costUsd: number;
}

function dayKey(timestamp: number): string {
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayKey(): string {
  return dayKey(Date.now());
}

function calcCost(usage: TokenUsage): number {
  const pricing = MODEL_PRICING[usage.model] ?? MODEL_PRICING['default'];
  return (usage.inputTokens * pricing.input + usage.outputTokens * pricing.output) / 1_000_000;
}

const DEFAULT_ALERT_THRESHOLDS = [0.8, 0.9, 1.0];

export class CostTracker extends EventEmitter {
  private records: UsageRecord[] = [];
  // sessionId -> { tokens, costUsd }
  private bySession: Map<string, { sessionName: string; tokens: number; costUsd: number }> = new Map();
  // YYYY-MM-DD -> { tokens, costUsd }
  private byDay: Map<string, { tokens: number; costUsd: number }> = new Map();

  private budget: BudgetConfig = {
    dailyLimitUsd: null,
    weeklyLimitUsd: null,
    monthlyLimitUsd: null,
    alerts: [],
  };

  recordUsage(sessionId: string, sessionName: string, usage: TokenUsage): CostEstimate {
    const costUsd = calcCost(usage);
    const record: UsageRecord = { sessionId, sessionName, usage, costUsd };
    this.records.push(record);

    // Update session aggregate
    const existing = this.bySession.get(sessionId) ?? { sessionName, tokens: 0, costUsd: 0 };
    this.bySession.set(sessionId, {
      sessionName,
      tokens: existing.tokens + usage.totalTokens,
      costUsd: existing.costUsd + costUsd,
    });

    // Update day aggregate
    const dk = dayKey(usage.timestamp);
    const dayExisting = this.byDay.get(dk) ?? { tokens: 0, costUsd: 0 };
    this.byDay.set(dk, {
      tokens: dayExisting.tokens + usage.totalTokens,
      costUsd: dayExisting.costUsd + costUsd,
    });

    const estimate: CostEstimate = { usage, estimatedCostUsd: costUsd, sessionId };
    this.emit('cost:updated', estimate);

    // Check budgets after recording
    const triggered = this.checkBudget();
    for (const alert of triggered) {
      if (alert.threshold >= 1.0) {
        this.emit('budget:exceeded', alert);
      } else {
        this.emit('budget:alert', alert);
      }
    }

    return estimate;
  }

  getSessionCost(sessionId: string): { tokens: number; costUsd: number } {
    const entry = this.bySession.get(sessionId);
    return entry ? { tokens: entry.tokens, costUsd: entry.costUsd } : { tokens: 0, costUsd: 0 };
  }

  getTotalCost(): number {
    let total = 0;
    for (const record of this.records) {
      total += record.costUsd;
    }
    return total;
  }

  getDailySummary(date?: string): UsageSummary {
    const targetDay = date ?? todayKey();
    const startOfDay = new Date(targetDay + 'T00:00:00').getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;

    return this._buildSummary(startOfDay, endOfDay);
  }

  getWeeklySummary(): UsageSummary {
    const now = Date.now();
    const since = now - 7 * 24 * 60 * 60 * 1000;
    return this._buildSummary(since, now);
  }

  getMonthlySummary(): UsageSummary {
    const now = Date.now();
    const since = now - 30 * 24 * 60 * 60 * 1000;
    return this._buildSummary(since, now);
  }

  private _buildSummary(since: number, until: number): UsageSummary {
    const filtered = this.records.filter(
      r => r.usage.timestamp >= since && r.usage.timestamp <= until
    );

    let totalTokens = 0;
    let totalCostUsd = 0;

    // Build per-session aggregates for this window
    const sessionMap = new Map<string, { sessionName: string; tokens: number; costUsd: number }>();
    const dayMap = new Map<string, { tokens: number; costUsd: number }>();

    for (const record of filtered) {
      totalTokens += record.usage.totalTokens;
      totalCostUsd += record.costUsd;

      const s = sessionMap.get(record.sessionId) ?? { sessionName: record.sessionName, tokens: 0, costUsd: 0 };
      sessionMap.set(record.sessionId, {
        sessionName: record.sessionName,
        tokens: s.tokens + record.usage.totalTokens,
        costUsd: s.costUsd + record.costUsd,
      });

      const dk = dayKey(record.usage.timestamp);
      const d = dayMap.get(dk) ?? { tokens: 0, costUsd: 0 };
      dayMap.set(dk, { tokens: d.tokens + record.usage.totalTokens, costUsd: d.costUsd + record.costUsd });
    }

    const bySession = Array.from(sessionMap.entries()).map(([sessionId, v]) => ({
      sessionId,
      sessionName: v.sessionName,
      tokens: v.tokens,
      costUsd: v.costUsd,
    }));

    const byDay = Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, tokens: v.tokens, costUsd: v.costUsd }));

    // Determine the most relevant budget limit for this window range
    const windowDays = (until - since) / (24 * 60 * 60 * 1000);
    let budgetLimit: number | null = null;
    if (windowDays <= 1) {
      budgetLimit = this.budget.dailyLimitUsd;
    } else if (windowDays <= 7) {
      budgetLimit = this.budget.weeklyLimitUsd;
    } else {
      budgetLimit = this.budget.monthlyLimitUsd;
    }

    return {
      period: { since, until },
      totalTokens,
      totalCostUsd,
      bySession,
      byDay,
      budgetLimit,
      budgetUsed: budgetLimit !== null ? totalCostUsd / budgetLimit : 0,
    };
  }

  setBudget(config: Partial<BudgetConfig>): void {
    this.budget = {
      ...this.budget,
      ...config,
      alerts: config.alerts ?? this._buildDefaultAlerts(),
    };
  }

  getBudget(): BudgetConfig {
    return { ...this.budget, alerts: [...this.budget.alerts] };
  }

  checkBudget(): BudgetAlert[] {
    const now = Date.now();
    const triggered: BudgetAlert[] = [];

    const checks: Array<{ limit: number | null; spent: number; period: string }> = [
      { limit: this.budget.dailyLimitUsd,   spent: this._spentSince(now - 24 * 60 * 60 * 1000),        period: 'daily' },
      { limit: this.budget.weeklyLimitUsd,  spent: this._spentSince(now - 7 * 24 * 60 * 60 * 1000),   period: 'weekly' },
      { limit: this.budget.monthlyLimitUsd, spent: this._spentSince(now - 30 * 24 * 60 * 60 * 1000),  period: 'monthly' },
    ];

    for (const { limit, spent, period } of checks) {
      if (limit === null) continue;
      const ratio = spent / limit;

      for (const alert of this.budget.alerts) {
        if (alert.triggered) continue;
        if (ratio >= alert.threshold) {
          const pct = Math.round(alert.threshold * 100);
          const updatedAlert: BudgetAlert = {
            ...alert,
            triggered: true,
            triggeredAt: now,
            message: `${period} budget ${pct}% used ($${spent.toFixed(2)} of $${limit.toFixed(2)})`,
          };
          // Update in-place
          const idx = this.budget.alerts.indexOf(alert);
          if (idx !== -1) this.budget.alerts[idx] = updatedAlert;
          triggered.push(updatedAlert);
        }
      }
    }

    return triggered;
  }

  reset(): void {
    this.records = [];
    this.bySession.clear();
    this.byDay.clear();
    this.budget = {
      dailyLimitUsd: null,
      weeklyLimitUsd: null,
      monthlyLimitUsd: null,
      alerts: [],
    };
  }

  private _spentSince(since: number): number {
    return this.records
      .filter(r => r.usage.timestamp >= since)
      .reduce((sum, r) => sum + r.costUsd, 0);
  }

  private _buildDefaultAlerts(): BudgetAlert[] {
    return DEFAULT_ALERT_THRESHOLDS.map(threshold => ({
      id: crypto.randomUUID(),
      threshold,
      triggered: false,
      message: '',
    }));
  }
}
