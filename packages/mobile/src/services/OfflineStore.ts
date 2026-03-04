import type { CachedMessage, SyncState } from '@doublt/shared/src/types/offline.js';
import type { ChatMessage, SessionNotification } from '@doublt/shared';

// In-memory store (production would use AsyncStorage)
const store = new Map<string, string>();

const CACHE_PREFIX = '@doublt:cache:';
const MAX_MESSAGES_PER_SESSION = 200;
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export class OfflineStore {
  // Cache messages for a session
  async cacheMessages(sessionId: string, messages: ChatMessage[]): Promise<void> {
    const cached: CachedMessage[] = messages.slice(-MAX_MESSAGES_PER_SESSION).map(m => ({
      ...m,
      cachedAt: Date.now(),
    }));
    store.set(`${CACHE_PREFIX}messages:${sessionId}`, JSON.stringify(cached));
  }

  // Load cached messages for a session
  async loadMessages(sessionId: string): Promise<CachedMessage[]> {
    const raw = store.get(`${CACHE_PREFIX}messages:${sessionId}`);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as CachedMessage[];
    } catch {
      return [];
    }
  }

  // Cache notifications
  async cacheNotifications(notifications: SessionNotification[]): Promise<void> {
    store.set(`${CACHE_PREFIX}notifications`, JSON.stringify(notifications.slice(0, 100)));
  }

  async loadNotifications(): Promise<SessionNotification[]> {
    const raw = store.get(`${CACHE_PREFIX}notifications`);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as SessionNotification[];
    } catch {
      return [];
    }
  }

  // Cache session/workspace metadata
  async cacheMetadata(key: string, data: unknown): Promise<void> {
    store.set(`${CACHE_PREFIX}meta:${key}`, JSON.stringify(data));
  }

  async loadMetadata<T>(key: string): Promise<T | null> {
    const raw = store.get(`${CACHE_PREFIX}meta:${key}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  // Get sync state
  async getSyncState(): Promise<SyncState> {
    let cacheSize = 0;
    store.forEach((value, key) => {
      if (key.startsWith(CACHE_PREFIX)) cacheSize += value.length;
    });
    const lastSyncRaw = store.get(`${CACHE_PREFIX}lastSync`);
    return {
      lastSyncedAt: lastSyncRaw ? parseInt(lastSyncRaw, 10) : 0,
      pendingCount: 0,
      cacheSize,
      isOnline: true,
    };
  }

  async setLastSynced(): Promise<void> {
    store.set(`${CACHE_PREFIX}lastSync`, Date.now().toString());
  }

  // Clean expired cache entries
  async cleanup(): Promise<number> {
    const cutoff = Date.now() - CACHE_EXPIRY_MS;
    let cleaned = 0;
    // In production, would iterate AsyncStorage keys and check cachedAt
    return cleaned;
  }

  // Clear all cached data
  async clearAll(): Promise<void> {
    const keysToDelete: string[] = [];
    store.forEach((_, key) => {
      if (key.startsWith(CACHE_PREFIX)) keysToDelete.push(key);
    });
    keysToDelete.forEach(k => store.delete(k));
  }
}
