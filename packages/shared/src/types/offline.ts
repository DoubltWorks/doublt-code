import type { ChatMessage } from './message.js';

export interface CachedMessage extends ChatMessage {
  cachedAt: number;
}

export type PendingActionType = 'chat:send' | 'tool:approve' | 'session:create' | 'handoff:trigger';

export interface PendingAction {
  id: string;
  type: PendingActionType;
  payload: Record<string, unknown>;
  createdAt: number;
  retryCount: number;
  maxRetries: number;
  lastRetryAt?: number;
}

export interface SyncState {
  lastSyncedAt: number;
  pendingCount: number;
  cacheSize: number;
  isOnline: boolean;
}
