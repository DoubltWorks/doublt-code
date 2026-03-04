import { EventEmitter } from 'events';
import type { PendingAction, PendingActionType } from '@doublt/shared/src/types/offline.js';
import type { StorageBackend } from './OfflineStore.js';

const QUEUE_STORAGE_KEY = '@doublt:syncqueue';

export class SyncQueue extends EventEmitter {
  private queue: PendingAction[] = [];
  private isFlushing = false;
  private maxRetries = 3;
  private storage: StorageBackend | null = null;

  get pendingCount(): number { return this.queue.length; }
  get isEmpty(): boolean { return this.queue.length === 0; }

  /** Attach storage backend for queue persistence across app restarts */
  setStorage(storage: StorageBackend): void {
    this.storage = storage;
  }

  /** Load persisted queue from storage (call on app startup) */
  async loadPersistedQueue(): Promise<void> {
    if (!this.storage) return;
    const raw = await this.storage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return;
    try {
      const persisted = JSON.parse(raw) as PendingAction[];
      // Merge: keep existing in-memory items, add persisted ones not already present
      const existingIds = new Set(this.queue.map(a => a.id));
      for (const action of persisted) {
        if (!existingIds.has(action.id)) {
          this.queue.push(action);
        }
      }
    } catch {
      // Corrupt data — ignore
    }
  }

  /** Persist current queue to storage */
  private async persist(): Promise<void> {
    if (!this.storage) return;
    try {
      await this.storage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
    } catch {
      // Storage failure — queue remains in memory
    }
  }

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
    void this.persist();
    return action;
  }

  /**
   * Flush all pending actions (called on reconnect).
   * Uses exponential backoff between retry attempts.
   * After flush completes, emits 'serverSyncNeeded' for server-wins resolution.
   */
  async flush(sender: (action: PendingAction) => Promise<boolean>): Promise<{ sent: number; failed: number }> {
    if (this.isFlushing || this.queue.length === 0) return { sent: 0, failed: 0 };
    this.isFlushing = true;
    let sent = 0;
    let failed = 0;
    const remaining: PendingAction[] = [];

    try {
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
    } finally {
      this.queue = remaining;
      this.isFlushing = false;
    }

    this.emit('flushed', { sent, failed, remaining: remaining.length });
    void this.persist();

    // Signal that the caller should request fresh server state (server-wins)
    this.emit('serverSyncNeeded');

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
    void this.persist();
  }

  // Remove a specific action
  remove(actionId: string): boolean {
    const idx = this.queue.findIndex(a => a.id === actionId);
    if (idx >= 0) {
      this.queue.splice(idx, 1);
      void this.persist();
      return true;
    }
    return false;
  }
}
