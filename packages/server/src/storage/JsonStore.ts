/**
 * JsonStore — Atomic JSON file persistence for doublt-code.
 *
 * Provides durable state storage using JSON files with:
 * - Atomic writes (tmp file + rename) to prevent corruption
 * - Debounced auto-save (1s default) to reduce disk I/O
 * - Backup on corruption detection
 * - Simple key-value store per data domain
 *
 * Data directory: ~/.doublt/data/
 */

import { EventEmitter } from 'node:events';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

export interface JsonStoreOptions {
  /** Base directory for data files (default: ~/.doublt/data/) */
  dataDir?: string;
  /** Debounce interval for auto-save in ms (default: 1000) */
  debounceMs?: number;
}

const DEFAULT_DATA_DIR = path.join(os.homedir(), '.doublt', 'data');
const DEFAULT_DEBOUNCE_MS = 1000;

export class JsonStore extends EventEmitter {
  private dataDir: string;
  private debounceMs: number;
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private pendingData = new Map<string, unknown>();
  private initialized = false;

  constructor(options: JsonStoreOptions = {}) {
    super();
    this.dataDir = options.dataDir ?? DEFAULT_DATA_DIR;
    this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  }

  /**
   * Ensure data directory exists.
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    await fs.mkdir(this.dataDir, { recursive: true });
    this.initialized = true;
  }

  /**
   * Load data from a JSON file. Returns null if file doesn't exist.
   * If the file is corrupted, attempts to restore from backup.
   */
  async load<T>(filename: string): Promise<T | null> {
    await this.init();
    const filePath = path.join(this.dataDir, filename);

    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as T;
    } catch (err: unknown) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === 'ENOENT') {
        return null; // File doesn't exist yet
      }

      // File exists but is corrupted — try backup
      this.emit('store:corrupted', { filename, error: error.message });
      return this.loadBackup<T>(filename);
    }
  }

  /**
   * Save data to a JSON file atomically.
   * Uses tmp file + rename to prevent corruption on crash.
   */
  async save(filename: string, data: unknown): Promise<void> {
    await this.init();
    const filePath = path.join(this.dataDir, filename);
    const tmpPath = `${filePath}.${crypto.randomUUID().slice(0, 8)}.tmp`;
    const backupPath = `${filePath}.bak`;

    const json = JSON.stringify(data, null, 2);

    try {
      // Write to temp file first
      await fs.writeFile(tmpPath, json, 'utf-8');

      // Backup existing file before overwriting
      try {
        await fs.copyFile(filePath, backupPath);
      } catch {
        // No existing file to backup — that's fine
      }

      // Atomic rename
      await fs.rename(tmpPath, filePath);
      this.emit('store:saved', { filename, size: json.length });
    } catch (err: unknown) {
      // Clean up tmp file on failure
      try {
        await fs.unlink(tmpPath);
      } catch {
        // Ignore cleanup errors
      }
      throw err;
    }
  }

  /**
   * Schedule a debounced save. Multiple calls within the debounce
   * window will only trigger one write.
   */
  scheduleSave(filename: string, data: unknown): void {
    const existing = this.debounceTimers.get(filename);
    if (existing) clearTimeout(existing);

    // Store pending data so flush() can execute it
    this.pendingData.set(filename, data);

    const timer = setTimeout(() => {
      this.debounceTimers.delete(filename);
      const pendingData = this.pendingData.get(filename);
      this.pendingData.delete(filename);
      this.save(filename, pendingData).catch(err => {
        this.emit('store:error', { filename, error: (err as Error).message });
      });
    }, this.debounceMs);

    this.debounceTimers.set(filename, timer);
  }

  /**
   * Load from backup file.
   */
  private async loadBackup<T>(filename: string): Promise<T | null> {
    const backupPath = path.join(this.dataDir, `${filename}.bak`);
    try {
      const data = await fs.readFile(backupPath, 'utf-8');
      const parsed = JSON.parse(data) as T;
      this.emit('store:restored_from_backup', { filename });

      // Restore the backup as the main file
      await this.save(filename, parsed);
      return parsed;
    } catch {
      this.emit('store:backup_failed', { filename });
      return null;
    }
  }

  /**
   * Delete a data file and its backup.
   */
  async delete(filename: string): Promise<void> {
    await this.init();
    const filePath = path.join(this.dataDir, filename);
    const backupPath = `${filePath}.bak`;
    try { await fs.unlink(filePath); } catch { /* ignore */ }
    try { await fs.unlink(backupPath); } catch { /* ignore */ }
  }

  /**
   * List all data files in the store.
   */
  async listFiles(): Promise<string[]> {
    await this.init();
    try {
      const files = await fs.readdir(this.dataDir);
      return files.filter(f => f.endsWith('.json'));
    } catch {
      return [];
    }
  }

  /**
   * Flush all pending debounced saves immediately.
   * Executes all pending saves before clearing timers.
   */
  async flush(): Promise<void> {
    // Clear all debounce timers first to prevent double-writes
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Execute all pending saves
    const saves: Promise<void>[] = [];
    for (const [filename, data] of this.pendingData) {
      saves.push(
        this.save(filename, data).catch(err => {
          this.emit('store:error', { filename, error: (err as Error).message });
        }),
      );
    }
    this.pendingData.clear();
    await Promise.all(saves);
  }

  /**
   * Clean up timers on shutdown. Use flush() first to persist pending data.
   */
  destroy(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.pendingData.clear();
  }

  /**
   * Get the data directory path.
   */
  getDataDir(): string {
    return this.dataDir;
  }
}
