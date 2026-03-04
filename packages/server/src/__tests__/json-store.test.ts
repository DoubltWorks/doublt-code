import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JsonStore } from '../storage/JsonStore.js';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Use a temp directory for each test
function makeTempDir(): string {
  return path.join(os.tmpdir(), `doublt-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

describe('JsonStore', () => {
  let store: JsonStore;
  let dataDir: string;

  beforeEach(() => {
    dataDir = makeTempDir();
    store = new JsonStore({ dataDir, debounceMs: 50 });
  });

  afterEach(async () => {
    store.destroy();
    try {
      await fs.rm(dataDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('init', () => {
    it('creates data directory on init', async () => {
      await store.init();
      const stat = await fs.stat(dataDir);
      expect(stat.isDirectory()).toBe(true);
    });

    it('is idempotent', async () => {
      await store.init();
      await store.init();
      const stat = await fs.stat(dataDir);
      expect(stat.isDirectory()).toBe(true);
    });
  });

  describe('save / load', () => {
    it('round-trips data through save and load', async () => {
      const data = { sessions: [{ id: 's1', name: 'test' }], count: 42 };
      await store.save('sessions.json', data);
      const loaded = await store.load<typeof data>('sessions.json');
      expect(loaded).toEqual(data);
    });

    it('returns null for non-existent file', async () => {
      const result = await store.load('nonexistent.json');
      expect(result).toBeNull();
    });

    it('creates backup file on save', async () => {
      await store.save('test.json', { v: 1 });
      await store.save('test.json', { v: 2 });

      const backupPath = path.join(dataDir, 'test.json.bak');
      const backup = JSON.parse(await fs.readFile(backupPath, 'utf-8'));
      expect(backup.v).toBe(1); // backup has the previous version
    });

    it('handles complex nested data', async () => {
      const data = {
        workspaces: [
          {
            id: 'w1',
            name: 'default',
            sessions: ['s1', 's2'],
            metadata: { tags: ['dev', 'test'], nested: { deep: true } },
          },
        ],
        settings: { autoSave: true, interval: 1000 },
      };
      await store.save('complex.json', data);
      const loaded = await store.load<typeof data>('complex.json');
      expect(loaded).toEqual(data);
    });

    it('handles empty objects and arrays', async () => {
      await store.save('empty.json', { list: [], map: {} });
      const loaded = await store.load<any>('empty.json');
      expect(loaded).toEqual({ list: [], map: {} });
    });
  });

  describe('corruption recovery', () => {
    it('restores from backup when main file is corrupted', async () => {
      const events: string[] = [];
      store.on('store:corrupted', () => events.push('corrupted'));
      store.on('store:restored_from_backup', () => events.push('restored'));

      // Save valid data twice to create a backup
      await store.save('test.json', { v: 1 });
      await store.save('test.json', { v: 2 });

      // Corrupt the main file
      await fs.writeFile(path.join(dataDir, 'test.json'), 'not json!!!');

      const loaded = await store.load<any>('test.json');
      // Should restore from backup (v=1)
      expect(loaded?.v).toBe(1);
      expect(events).toContain('corrupted');
      expect(events).toContain('restored');
    });

    it('returns null when both main and backup are corrupted', async () => {
      const events: string[] = [];
      store.on('store:corrupted', () => events.push('corrupted'));
      store.on('store:backup_failed', () => events.push('backup_failed'));

      await store.save('test.json', { v: 1 });

      // Corrupt both files
      await fs.writeFile(path.join(dataDir, 'test.json'), 'bad');
      await fs.writeFile(path.join(dataDir, 'test.json.bak'), 'also bad');

      const loaded = await store.load<any>('test.json');
      expect(loaded).toBeNull();
      expect(events).toContain('backup_failed');
    });
  });

  describe('scheduleSave (debounced)', () => {
    it('debounces rapid saves', async () => {
      const events: any[] = [];
      store.on('store:saved', (e) => events.push(e));

      store.scheduleSave('debounce.json', { v: 1 });
      store.scheduleSave('debounce.json', { v: 2 });
      store.scheduleSave('debounce.json', { v: 3 });

      // Wait for debounce (50ms) + async save I/O
      await new Promise(resolve => setTimeout(resolve, 500));

      // Only one save should have happened
      expect(events.length).toBe(1);

      // Final value should be v=3
      const loaded = await store.load<any>('debounce.json');
      expect(loaded.v).toBe(3);
    });
  });

  describe('flush', () => {
    it('executes all pending debounced saves immediately', async () => {
      store.scheduleSave('flush-a.json', { a: 1 });
      store.scheduleSave('flush-b.json', { b: 2 });

      // Flush immediately — should not wait for debounce
      await store.flush();

      const a = await store.load<any>('flush-a.json');
      const b = await store.load<any>('flush-b.json');
      expect(a).toEqual({ a: 1 });
      expect(b).toEqual({ b: 2 });
    });

    it('uses the latest data when flushing', async () => {
      store.scheduleSave('flush-latest.json', { v: 1 });
      store.scheduleSave('flush-latest.json', { v: 2 });
      store.scheduleSave('flush-latest.json', { v: 3 });

      await store.flush();

      const loaded = await store.load<any>('flush-latest.json');
      expect(loaded.v).toBe(3);
    });

    it('does not double-write after flush', async () => {
      const events: any[] = [];
      store.on('store:saved', (e) => events.push(e));

      store.scheduleSave('flush-once.json', { v: 1 });
      await store.flush();

      // Wait longer than debounce interval
      await new Promise(resolve => setTimeout(resolve, 120));

      // Should only have saved once (from flush, not from debounce timer)
      const flushSaves = events.filter(e => e.filename === 'flush-once.json');
      expect(flushSaves.length).toBe(1);
    });
  });

  describe('delete', () => {
    it('removes file and backup', async () => {
      await store.save('del.json', { v: 1 });
      await store.save('del.json', { v: 2 }); // creates backup

      await store.delete('del.json');

      const loaded = await store.load<any>('del.json');
      expect(loaded).toBeNull();
    });
  });

  describe('listFiles', () => {
    it('lists all JSON files', async () => {
      await store.save('a.json', { a: 1 });
      await store.save('b.json', { b: 2 });

      const files = await store.listFiles();
      expect(files).toContain('a.json');
      expect(files).toContain('b.json');
      // Should not include .bak files
      expect(files.every(f => f.endsWith('.json'))).toBe(true);
    });

    it('returns empty array for empty store', async () => {
      const files = await store.listFiles();
      expect(files).toEqual([]);
    });
  });

  describe('getDataDir', () => {
    it('returns the configured data directory', () => {
      expect(store.getDataDir()).toBe(dataDir);
    });
  });

  // ─── Phase 5 additions: manager data roundtrips ──────

  describe('manager data roundtrips', () => {
    it('round-trips session manager data format', async () => {
      const sessionData = {
        sessions: [
          {
            id: 's1',
            workspaceId: 'w1',
            name: 'main',
            status: 'active',
            contextUsage: { used: 1000, limit: 200000, percentage: 0.5 },
            createdAt: Date.now(),
            clients: [],
          },
          {
            id: 's2',
            workspaceId: 'w1',
            name: 'feature-branch',
            status: 'archived',
            contextUsage: { used: 190000, limit: 200000, percentage: 95 },
            createdAt: Date.now(),
            clients: [],
          },
        ],
      };

      await store.save('sessions.json', sessionData);
      const loaded = await store.load<typeof sessionData>('sessions.json');
      expect(loaded).toEqual(sessionData);
      expect(loaded!.sessions).toHaveLength(2);
      expect(loaded!.sessions[0].contextUsage.used).toBe(1000);
    });

    it('round-trips workspace manager data format', async () => {
      const workspaceData = {
        workspaces: [
          {
            id: 'w1',
            name: 'default',
            rootPath: '/home/user/project',
            sessions: ['s1', 's2'],
            createdAt: Date.now(),
          },
        ],
      };

      await store.save('workspaces.json', workspaceData);
      const loaded = await store.load<typeof workspaceData>('workspaces.json');
      expect(loaded).toEqual(workspaceData);
    });

    it('round-trips task queue manager data format', async () => {
      const taskData = {
        tasks: [
          {
            id: 't1',
            title: 'Fix bug',
            description: 'Fix the authentication bug',
            priority: 'high',
            status: 'queued',
            sessionId: 's1',
            createdAt: Date.now(),
          },
        ],
        queue: { maxConcurrent: 1 },
      };

      await store.save('tasks.json', taskData);
      const loaded = await store.load<typeof taskData>('tasks.json');
      expect(loaded).toEqual(taskData);
    });

    it('round-trips approval policy manager data format', async () => {
      const policyData = {
        policies: [
          {
            id: 'p1',
            name: 'full_auto',
            preset: 'full_auto',
            rules: [],
            isActive: true,
          },
        ],
        sessionOverrides: { s1: 'p1' },
      };

      await store.save('policies.json', policyData);
      const loaded = await store.load<typeof policyData>('policies.json');
      expect(loaded).toEqual(policyData);
    });

    it('round-trips digest manager data format', async () => {
      const digestData = {
        events: [
          { type: 'session:created', sessionId: 's1', timestamp: Date.now(), summary: 'New session' },
          { type: 'command:complete', sessionId: 's1', timestamp: Date.now(), summary: 'Build done' },
        ],
        maxEvents: 10000,
      };

      await store.save('digest.json', digestData);
      const loaded = await store.load<typeof digestData>('digest.json');
      expect(loaded).toEqual(digestData);
      expect(loaded!.events).toHaveLength(2);
    });
  });

  describe('corruption edge cases', () => {
    it('recovers from truncated JSON file', async () => {
      await store.save('truncated.json', { v: 1 });
      await store.save('truncated.json', { v: 2 }); // creates backup of v:1

      await fs.writeFile(path.join(dataDir, 'truncated.json'), '{"v": ');

      const loaded = await store.load<any>('truncated.json');
      expect(loaded?.v).toBe(1); // restored from backup
    });

    it('recovers from empty file content', async () => {
      await store.save('empty-content.json', { v: 1 });
      await store.save('empty-content.json', { v: 2 }); // backup of v:1

      await fs.writeFile(path.join(dataDir, 'empty-content.json'), '');

      const loaded = await store.load<any>('empty-content.json');
      expect(loaded?.v).toBe(1);
    });

    it('returns null when file has no backup at all', async () => {
      // Write corrupted data directly (no prior save → no backup)
      await fs.mkdir(dataDir, { recursive: true });
      await fs.writeFile(path.join(dataDir, 'no-backup.json'), 'corrupted');

      const loaded = await store.load<any>('no-backup.json');
      expect(loaded).toBeNull();
    });
  });

  describe('concurrent scheduleSave operations', () => {
    it('handles concurrent scheduleSave for different files', async () => {
      store.scheduleSave('concurrent-a.json', { a: 1 });
      store.scheduleSave('concurrent-b.json', { b: 2 });
      store.scheduleSave('concurrent-c.json', { c: 3 });

      await store.flush();

      const a = await store.load<any>('concurrent-a.json');
      const b = await store.load<any>('concurrent-b.json');
      const c = await store.load<any>('concurrent-c.json');
      expect(a).toEqual({ a: 1 });
      expect(b).toEqual({ b: 2 });
      expect(c).toEqual({ c: 3 });
    });

    it('last write wins for same file with scheduleSave', async () => {
      store.scheduleSave('race.json', { version: 1 });
      store.scheduleSave('race.json', { version: 2 });
      store.scheduleSave('race.json', { version: 3 });
      store.scheduleSave('race.json', { version: 4 });
      store.scheduleSave('race.json', { version: 5 });

      await store.flush();

      const loaded = await store.load<any>('race.json');
      expect(loaded.version).toBe(5);
    });
  });

  describe('debounce verification', () => {
    it('debounce timer resets on each scheduleSave call', async () => {
      const events: any[] = [];
      store.on('store:saved', (e) => events.push(e));

      store.scheduleSave('reset.json', { v: 1 });
      await new Promise(resolve => setTimeout(resolve, 30));
      store.scheduleSave('reset.json', { v: 2 });
      await new Promise(resolve => setTimeout(resolve, 30));
      store.scheduleSave('reset.json', { v: 3 });

      // Not enough time has passed for any debounce to fire
      expect(events.filter(e => e.filename === 'reset.json')).toHaveLength(0);

      // Wait for debounce (50ms) + async save I/O
      await new Promise(resolve => setTimeout(resolve, 500));

      expect(events.filter(e => e.filename === 'reset.json')).toHaveLength(1);
      const loaded = await store.load<any>('reset.json');
      expect(loaded.v).toBe(3);
    });
  });
});
