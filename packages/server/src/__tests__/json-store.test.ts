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

      // Wait for debounce (50ms + buffer)
      await new Promise(resolve => setTimeout(resolve, 120));

      // Only one save should have happened
      expect(events.length).toBe(1);

      // Final value should be v=3
      const loaded = await store.load<any>('debounce.json');
      expect(loaded.v).toBe(3);
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
});
