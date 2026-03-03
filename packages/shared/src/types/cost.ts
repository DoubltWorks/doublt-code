export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  model: string;
  timestamp: number;
}

export interface CostEstimate {
  usage: TokenUsage;
  estimatedCostUsd: number;
  sessionId: string;
}

export interface UsageSummary {
  period: { since: number; until: number };
  totalTokens: number;
  totalCostUsd: number;
  bySession: Array<{ sessionId: string; sessionName: string; tokens: number; costUsd: number }>;
  byDay: Array<{ date: string; tokens: number; costUsd: number }>;
  budgetLimit: number | null;
  budgetUsed: number;
}

export interface BudgetAlert {
  id: string;
  threshold: number; // 0-1 (e.g. 0.8 = 80%)
  triggered: boolean;
  message: string;
  triggeredAt?: number;
}

export interface BudgetConfig {
  dailyLimitUsd: number | null;
  weeklyLimitUsd: number | null;
  monthlyLimitUsd: number | null;
  alerts: BudgetAlert[];
}
