export type TaskPriority = 'critical' | 'high' | 'normal' | 'low';
export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  sessionId?: string;
  workspaceId?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: string;
  error?: string;
}

export interface TaskQueue {
  id: string;
  workspaceId: string;
  tasks: Task[];
  maxConcurrent: number;
}

export interface ScheduledTask extends Task {
  cronExpression: string;
  nextRunAt: number;
  lastRunAt?: number;
  enabled: boolean;
}
