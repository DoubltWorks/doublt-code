export type ApprovalAction = 'auto_approve' | 'require_confirm' | 'block';

export interface ApprovalRule {
  id: string;
  /** Glob pattern matching tool names (e.g., "file_write", "shell_*") */
  toolPattern: string;
  action: ApprovalAction;
  /** Optional reason for the rule */
  reason?: string;
}

export interface ApprovalPolicy {
  id: string;
  name: string;
  description: string;
  rules: ApprovalRule[];
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export type ApprovalPreset = 'conservative' | 'moderate' | 'permissive' | 'full_auto';

export interface ApprovalQueueItem {
  id: string;
  sessionId: string;
  toolName: string;
  input: Record<string, unknown>;
  riskLevel: 'low' | 'medium' | 'high';
  createdAt: number;
  status: 'pending' | 'approved' | 'denied';
}

export interface ApprovalDecision {
  queueItemId: string;
  approved: boolean;
  reason?: string;
  decidedBy: string;
  decidedAt: number;
}

/** Time-based policy schedule (simple HH:MM-HH:MM range) */
export interface ScheduledPolicy {
  policyId: string;
  /** Time range in "HH:MM-HH:MM" format (e.g., "22:00-06:00" for overnight) */
  timeRange: string;
  enabled: boolean;
}

/** Session-level policy override */
export interface SessionPolicyOverride {
  sessionId: string;
  policyId: string;
  setAt: number;
}
