import { EventEmitter } from 'events';
import type { PendingAction, PendingActionType } from '@doublt/shared/src/types/offline.js';

export class SyncQueue extends EventEmitter {
  private queue: PendingAction[] = [];
  private isFlushing = false;
  private maxRetries = 3;

  get pendingCount(): number { return this.queue.length; }
  get isEmpty(): boolean { return this.queue.length === 0; }

  // Add action to queue
  enqueue(type: PendingActionType, payload: Record<string, unknown>): PendingAction {
    const action: PendingAction = {
      id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      payload,
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: this.maxRetries,
    };
    this.queue.push(action);
    this.emit('enqueued', action);
    return action;
  }

  // Flush all pending actions (called on reconnect)
  async flush(sender: (action: PendingAction) => Promise<boolean>): Promise<{ sent: number; failed: number }> {
    if (this.isFlushing || this.queue.length === 0) return { sent: 0, failed: 0 };
    this.isFlushing = true;
    let sent = 0;
    let failed = 0;
    const remaining: PendingAction[] = [];

    for (const action of this.queue) {
      try {
        const success = await sender(action);
        if (success) {
          sent++;
          this.emit('sent', action);
        } else {
          action.retryCount++;
          action.lastRetryAt = Date.now();
          if (action.retryCount < action.maxRetries) {
            remaining.push(action);
          } else {
            failed++;
            this.emit('failed', action);
          }
        }
      } catch {
        action.retryCount++;
        action.lastRetryAt = Date.now();
        if (action.retryCount < action.maxRetries) {
          remaining.push(action);
        } else {
          failed++;
          this.emit('failed', action);
        }
      }
    }

    this.queue = remaining;
    this.isFlushing = false;
    this.emit('flushed', { sent, failed, remaining: remaining.length });
    return { sent, failed };
  }

  // Get all pending actions
  getAll(): PendingAction[] {
    return [...this.queue];
  }

  // Clear the queue
  clear(): void {
    this.queue = [];
    this.emit('cleared');
  }

  // Remove a specific action
  remove(actionId: string): boolean {
    const idx = this.queue.findIndex(a => a.id === actionId);
    if (idx >= 0) {
      this.queue.splice(idx, 1);
      return true;
    }
    return false;
  }
}
