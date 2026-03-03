import { EventEmitter } from 'events';
import crypto from 'crypto';
import type { Task, TaskPriority, ScheduledTask } from '@doublt/shared';

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export class TaskQueueManager extends EventEmitter {
  private tasks: Map<string, Task> = new Map();
  private scheduledTasks: Map<string, ScheduledTask> = new Map();
  private scheduleInterval: ReturnType<typeof setInterval>;

  constructor() {
    super();
    this.scheduleInterval = setInterval(() => this._checkScheduledTasks(), 60_000);
  }

  private generateId(): string {
    return crypto.randomUUID().slice(0, 8);
  }

  createTask(
    title: string,
    description: string,
    priority: TaskPriority,
    workspaceId?: string,
    sessionId?: string,
  ): Task {
    const task: Task = {
      id: this.generateId(),
      title,
      description,
      priority,
      status: 'queued',
      workspaceId,
      sessionId,
      createdAt: Date.now(),
    };
    this.tasks.set(task.id, task);
    this.emit('task:created', task);
    return task;
  }

  updateTask(id: string, updates: Partial<Task>): Task | null {
    const task = this.tasks.get(id);
    if (!task) return null;
    const updated: Task = { ...task, ...updates, id: task.id };
    this.tasks.set(id, updated);
    return updated;
  }

  deleteTask(id: string): boolean {
    return this.tasks.delete(id);
  }

  reorderTasks(taskIds: string[]): void {
    const reordered = new Map<string, Task>();
    for (const id of taskIds) {
      const task = this.tasks.get(id);
      if (task) reordered.set(id, task);
    }
    // Re-add any tasks not in the provided list
    for (const [id, task] of this.tasks) {
      if (!reordered.has(id)) reordered.set(id, task);
    }
    this.tasks = reordered;
  }

  listTasks(workspaceId?: string): Task[] {
    const all = Array.from(this.tasks.values());
    if (workspaceId) return all.filter((t) => t.workspaceId === workspaceId);
    return all;
  }

  getTask(id: string): Task | null {
    return this.tasks.get(id) ?? null;
  }

  dequeueNext(): Task | null {
    const queued = Array.from(this.tasks.values())
      .filter((t) => t.status === 'queued')
      .sort((a, b) => {
        const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        if (pd !== 0) return pd;
        return a.createdAt - b.createdAt;
      });
    return queued[0] ?? null;
  }

  startTask(id: string): Task | null {
    const task = this.tasks.get(id);
    if (!task) return null;
    const updated = this.updateTask(id, { status: 'running', startedAt: Date.now() });
    if (updated) this.emit('task:started', updated);
    return updated;
  }

  completeTask(id: string, result?: string): Task | null {
    const task = this.tasks.get(id);
    if (!task) return null;
    const updated = this.updateTask(id, { status: 'completed', completedAt: Date.now(), result });
    if (updated) this.emit('task:completed', updated);
    return updated;
  }

  failTask(id: string, error?: string): Task | null {
    const task = this.tasks.get(id);
    if (!task) return null;
    const updated = this.updateTask(id, { status: 'failed', completedAt: Date.now(), error });
    if (updated) this.emit('task:failed', updated);
    return updated;
  }

  cancelTask(id: string): Task | null {
    const task = this.tasks.get(id);
    if (!task) return null;
    const updated = this.updateTask(id, { status: 'cancelled', completedAt: Date.now() });
    if (updated) this.emit('task:cancelled', updated);
    return updated;
  }

  scheduleTask(task: Task, cronExpression: string): ScheduledTask {
    const scheduled: ScheduledTask = {
      ...task,
      cronExpression,
      nextRunAt: Date.now() + 60_000,
      enabled: true,
    };
    this.scheduledTasks.set(task.id, scheduled);
    return scheduled;
  }

  unscheduleTask(id: string): boolean {
    return this.scheduledTasks.delete(id);
  }

  getRunningTasks(): Task[] {
    return Array.from(this.tasks.values()).filter((t) => t.status === 'running');
  }

  private _checkScheduledTasks(): void {
    const now = Date.now();
    for (const scheduled of this.scheduledTasks.values()) {
      if (scheduled.enabled && scheduled.nextRunAt <= now) {
        const newTask = this.createTask(
          scheduled.title,
          scheduled.description,
          scheduled.priority,
          scheduled.workspaceId,
          scheduled.sessionId,
        );
        scheduled.lastRunAt = now;
        scheduled.nextRunAt = now + 60_000;
        this.scheduledTasks.set(scheduled.id, scheduled);
        void newTask;
      }
    }
  }

  destroy(): void {
    clearInterval(this.scheduleInterval);
  }
}
