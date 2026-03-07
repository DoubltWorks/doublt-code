import type { CachedMessage, SyncState } from '@doublt/shared/src/types/offline.js';
import type { ChatMessage, SessionNotification, CommandMacro } from '@doublt/shared';

/**
 * Storage backend interface — matches AsyncStorage API shape.
 * Pass the real AsyncStorage from @react-native-async-storage/async-storage
 * in production, or use the built-in MemoryStorage fallback for tests.
 */
export interface StorageBackend {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getAllKeys(): Promise<readonly string[]>;
  multiRemove(keys: readonly string[]): Promise<void>;
}

/** In-memory fallback for environments without AsyncStorage */
export class MemoryStorage implements StorageBackend {
  private store = new Map<string, string>();
  async getItem(key: string) { return this.store.get(key) ?? null; }
  async setItem(key: string, value: string) { this.store.set(key, value); }
  async removeItem(key: string) { this.store.delete(key); }
  async getAllKeys() { return [...this.store.keys()]; }
  async multiRemove(keys: readonly string[]) { keys.forEach(k => this.store.delete(k)); }
}

const CACHE_PREFIX = '@doublt:cache:';
const MAX_MESSAGES_PER_SESSION = 200;
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export class OfflineStore {
  private storage: StorageBackend;

  constructor(storage?: StorageBackend) {
    this.storage = storage ?? new MemoryStorage();
  }

  // ─── Messages ──────────────────────────────────────

  async cacheMessages(sessionId: string, messages: ChatMessage[]): Promise<void> {
    const cached: CachedMessage[] = messages.slice(-MAX_MESSAGES_PER_SESSION).map(m => ({
      ...m,
      cachedAt: Date.now(),
    }));
    await this.storage.setItem(`${CACHE_PREFIX}messages:${sessionId}`, JSON.stringify(cached));
  }

  async loadMessages(sessionId: string): Promise<CachedMessage[]> {
    const raw = await this.storage.getItem(`${CACHE_PREFIX}messages:${sessionId}`);
    if (!raw) return [];
    try {
      const messages = JSON.parse(raw) as CachedMessage[];
      const cutoff = Date.now() - CACHE_EXPIRY_MS;
      return messages.filter(m => m.cachedAt > cutoff);
    } catch {
      return [];
    }
  }

  // ─── Notifications ─────────────────────────────────

  async cacheNotifications(notifications: SessionNotification[]): Promise<void> {
    const withTimestamp = notifications.slice(-100).map(n => ({
      ...n,
      cachedAt: Date.now(),
    }));
    await this.storage.setItem(`${CACHE_PREFIX}notifications`, JSON.stringify(withTimestamp));
  }

  async loadNotifications(): Promise<SessionNotification[]> {
    const raw = await this.storage.getItem(`${CACHE_PREFIX}notifications`);
    if (!raw) return [];
    try {
      const items = JSON.parse(raw) as Array<SessionNotification & { cachedAt?: number }>;
      const cutoff = Date.now() - CACHE_EXPIRY_MS;
      return items.filter(n => !n.cachedAt || n.cachedAt > cutoff);
    } catch {
      return [];
    }
  }

  // ─── Metadata (sessions, workspaces) ───────────────

  async cacheMetadata(key: string, data: unknown): Promise<void> {
    await this.storage.setItem(
      `${CACHE_PREFIX}meta:${key}`,
      JSON.stringify({ data, cachedAt: Date.now() }),
    );
  }

  async loadMetadata<T>(key: string): Promise<T | null> {
    const raw = await this.storage.getItem(`${CACHE_PREFIX}meta:${key}`);
    if (!raw) return null;
    try {
      const { data, cachedAt } = JSON.parse(raw) as { data: T; cachedAt: number };
      if (Date.now() - cachedAt > CACHE_EXPIRY_MS) {
        await this.storage.removeItem(`${CACHE_PREFIX}meta:${key}`);
        return null;
      }
      return data;
    } catch {
      return null;
    }
  }

  // ─── Macros ──────────────────────────────────────

  async cacheMacros(macros: CommandMacro[]): Promise<void> {
    await this.storage.setItem(`${CACHE_PREFIX}macros`, JSON.stringify({ data: macros, cachedAt: Date.now() }));
  }

  async loadMacros(): Promise<CommandMacro[]> {
    const raw = await this.storage.getItem(`${CACHE_PREFIX}macros`);
    if (!raw) return [];
    try {
      const { data } = JSON.parse(raw) as { data: CommandMacro[]; cachedAt: number };
      return data ?? [];
    } catch {
      return [];
    }
  }

  // ─── Sync State ────────────────────────────────────

  async getSyncState(pendingCount = 0, isOnline = true): Promise<SyncState> {
    let cacheSize = 0;
    const allKeys = await this.storage.getAllKeys();
    for (const key of allKeys) {
      if (key.startsWith(CACHE_PREFIX)) {
        const val = await this.storage.getItem(key);
        if (val) cacheSize += val.length;
      }
    }
    const lastSyncRaw = await this.storage.getItem(`${CACHE_PREFIX}lastSync`);
    return {
      lastSyncedAt: lastSyncRaw ? parseInt(lastSyncRaw, 10) : 0,
      pendingCount,
      cacheSize,
      isOnline,
    };
  }

  async setLastSynced(): Promise<void> {
    await this.storage.setItem(`${CACHE_PREFIX}lastSync`, Date.now().toString());
  }

  // ─── Cleanup ───────────────────────────────────────

  async cleanup(): Promise<number> {
    const cutoff = Date.now() - CACHE_EXPIRY_MS;
    let cleaned = 0;
    const allKeys = await this.storage.getAllKeys();
    const expiredKeys: string[] = [];

    for (const key of allKeys) {
      if (!key.startsWith(CACHE_PREFIX)) continue;
      if (key === `${CACHE_PREFIX}lastSync`) continue;

      const raw = await this.storage.getItem(key);
      if (!raw) continue;

      try {
        const parsed = JSON.parse(raw);
        // Array entries: check first item's cachedAt
        const cachedAt = Array.isArray(parsed)
          ? parsed[0]?.cachedAt
          : parsed?.cachedAt;
        if (cachedAt && cachedAt < cutoff) {
          expiredKeys.push(key);
          cleaned++;
        }
      } catch {
        // Corrupt data — remove
        expiredKeys.push(key);
        cleaned++;
      }
    }

    if (expiredKeys.length > 0) {
      await this.storage.multiRemove(expiredKeys);
    }
    return cleaned;
  }

  async clearAll(): Promise<void> {
    const allKeys = await this.storage.getAllKeys();
    const cacheKeys = allKeys.filter(k => k.startsWith(CACHE_PREFIX));
    if (cacheKeys.length > 0) {
      await this.storage.multiRemove(cacheKeys);
    }
  }
}
