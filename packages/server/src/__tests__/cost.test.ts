import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CostTracker } from '../cost/CostTracker.js';
import { makeTokenUsage } from './fixtures/index.js';

describe('CostTracker', () => {
  let tracker: CostTracker;

  beforeEach(() => {
    tracker = new CostTracker();
  });

  describe('cost calculation by model', () => {
    it('should calculate cost for claude-3-haiku', () => {
      const usage = makeTokenUsage({
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        totalTokens: 2_000_000,
        model: 'claude-3-haiku',
      });
      const estimate = tracker.recordUsage('s1', 'Session 1', usage);
      // haiku: input $0.25/M + output $1.25/M = $1.50
      expect(estimate.estimatedCostUsd).toBeCloseTo(1.5, 2);
    });

    it('should calculate cost for claude-3-opus', () => {
      const usage = makeTokenUsage({
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        totalTokens: 2_000_000,
        model: 'claude-3-opus',
      });
      const estimate = tracker.recordUsage('s1', 'Session 1', usage);
      // opus: input $15/M + output $75/M = $90
      expect(estimate.estimatedCostUsd).toBeCloseTo(90.0, 2);
    });

    it('should use default pricing for unknown models', () => {
      const usage = makeTokenUsage({
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        totalTokens: 2_000_000,
        model: 'unknown-model',
      });
      const estimate = tracker.recordUsage('s1', 'Session 1', usage);
      // default: input $3/M + output $15/M = $18
      expect(estimate.estimatedCostUsd).toBeCloseTo(18.0, 2);
    });
  });

  describe('session and daily aggregation', () => {
    it('should aggregate costs by session', () => {
      tracker.recordUsage('s1', 'S1', makeTokenUsage({ inputTokens: 100, outputTokens: 50, totalTokens: 150 }));
      tracker.recordUsage('s1', 'S1', makeTokenUsage({ inputTokens: 200, outputTokens: 100, totalTokens: 300 }));

      const cost = tracker.getSessionCost('s1');
      expect(cost.tokens).toBe(450);
      expect(cost.costUsd).toBeGreaterThan(0);
    });

    it('should return zero for unknown session', () => {
      const cost = tracker.getSessionCost('unknown');
      expect(cost.tokens).toBe(0);
      expect(cost.costUsd).toBe(0);
    });

    it('should track total cost across sessions', () => {
      tracker.recordUsage('s1', 'S1', makeTokenUsage());
      tracker.recordUsage('s2', 'S2', makeTokenUsage());

      expect(tracker.getTotalCost()).toBeGreaterThan(0);
    });
  });

  describe('summaries', () => {
    it('should generate daily summary', () => {
      tracker.recordUsage('s1', 'S1', makeTokenUsage());
      const summary = tracker.getDailySummary();

      expect(summary.totalTokens).toBeGreaterThan(0);
      expect(summary.totalCostUsd).toBeGreaterThan(0);
      expect(summary.bySession).toHaveLength(1);
      expect(summary.byDay).toHaveLength(1);
      expect(summary.period.since).toBeLessThan(summary.period.until);
    });

    it('should generate weekly summary', () => {
      tracker.recordUsage('s1', 'S1', makeTokenUsage());
      const summary = tracker.getWeeklySummary();
      expect(summary.totalTokens).toBeGreaterThan(0);
    });

    it('should generate monthly summary', () => {
      tracker.recordUsage('s1', 'S1', makeTokenUsage());
      const summary = tracker.getMonthlySummary();
      expect(summary.totalTokens).toBeGreaterThan(0);
    });

    it('should return empty summary for a date with no usage', () => {
      const summary = tracker.getDailySummary('2020-01-01');
      expect(summary.totalTokens).toBe(0);
      expect(summary.totalCostUsd).toBe(0);
      expect(summary.bySession).toHaveLength(0);
    });

    it('should include budgetUsed when limit is set', () => {
      tracker.setBudget({ dailyLimitUsd: 10 });
      tracker.recordUsage('s1', 'S1', makeTokenUsage({
        inputTokens: 1_000_000,
        outputTokens: 0,
        totalTokens: 1_000_000,
        model: 'claude-3-sonnet',
      }));
      const summary = tracker.getDailySummary();
      expect(summary.budgetLimit).toBe(10);
      expect(summary.budgetUsed).toBeGreaterThan(0);
    });
  });

  describe('budget alerts', () => {
    it('should trigger alert at 80% threshold', () => {
      const alertHandler = vi.fn();
      tracker.on('budget:alert', alertHandler);

      tracker.setBudget({ dailyLimitUsd: 1 });

      // Record enough to cross 80% of $1 = $0.80
      // sonnet: input $3/M, so need ~267k input tokens for $0.80
      tracker.recordUsage('s1', 'S1', makeTokenUsage({
        inputTokens: 300_000,
        outputTokens: 0,
        totalTokens: 300_000,
        model: 'claude-3-sonnet',
      }));

      expect(alertHandler).toHaveBeenCalled();
    });

    it('should trigger budget:exceeded at 100% threshold', () => {
      const exceededHandler = vi.fn();
      tracker.on('budget:exceeded', exceededHandler);

      tracker.setBudget({ dailyLimitUsd: 0.001 });

      tracker.recordUsage('s1', 'S1', makeTokenUsage({
        inputTokens: 10_000,
        outputTokens: 10_000,
        totalTokens: 20_000,
        model: 'claude-3-sonnet',
      }));

      expect(exceededHandler).toHaveBeenCalled();
    });

    it('should not trigger same alert twice', () => {
      const alertHandler = vi.fn();
      tracker.on('budget:alert', alertHandler);
      tracker.on('budget:exceeded', alertHandler);

      tracker.setBudget({ dailyLimitUsd: 0.001 });

      tracker.recordUsage('s1', 'S1', makeTokenUsage({
        inputTokens: 10_000,
        outputTokens: 10_000,
        totalTokens: 20_000,
      }));
      const firstCallCount = alertHandler.mock.calls.length;

      // Record again — alerts already triggered
      tracker.recordUsage('s1', 'S1', makeTokenUsage({
        inputTokens: 10_000,
        outputTokens: 10_000,
        totalTokens: 20_000,
      }));
      expect(alertHandler.mock.calls.length).toBe(firstCallCount);
    });
  });

  describe('budget management', () => {
    it('should set and get budget', () => {
      tracker.setBudget({ dailyLimitUsd: 10, weeklyLimitUsd: 50, monthlyLimitUsd: 200 });
      const budget = tracker.getBudget();
      expect(budget.dailyLimitUsd).toBe(10);
      expect(budget.weeklyLimitUsd).toBe(50);
      expect(budget.monthlyLimitUsd).toBe(200);
    });

    it('should build default alerts when setting budget', () => {
      tracker.setBudget({ dailyLimitUsd: 10 });
      const budget = tracker.getBudget();
      expect(budget.alerts).toHaveLength(3);
      expect(budget.alerts.map(a => a.threshold)).toEqual([0.8, 0.9, 1.0]);
    });
  });

  describe('reset', () => {
    it('should clear all data', () => {
      tracker.recordUsage('s1', 'S1', makeTokenUsage());
      tracker.setBudget({ dailyLimitUsd: 10 });
      tracker.reset();

      expect(tracker.getTotalCost()).toBe(0);
      expect(tracker.getSessionCost('s1').tokens).toBe(0);
      expect(tracker.getBudget().dailyLimitUsd).toBeNull();
    });
  });

  describe('events', () => {
    it('should emit cost:updated on recordUsage', () => {
      const handler = vi.fn();
      tracker.on('cost:updated', handler);
      tracker.recordUsage('s1', 'S1', makeTokenUsage());
      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0].sessionId).toBe('s1');
    });
  });
});
