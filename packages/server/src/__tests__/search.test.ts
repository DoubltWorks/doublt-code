import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SearchManager } from '../search/SearchManager.js';

describe('SearchManager', () => {
  let manager: SearchManager;

  beforeEach(() => {
    manager = new SearchManager();
  });

  describe('indexing', () => {
    it('should index a message', () => {
      const handler = vi.fn();
      manager.on('search:indexed', handler);

      manager.indexMessage('sess-1', 'msg-1', 'Hello world', Date.now());
      expect(handler).toHaveBeenCalledWith({ type: 'message', id: 'msg-1' });
    });

    it('should index a session', () => {
      manager.indexSession('sess-1', 'My Session', '/home/user/project');
      const results = manager.search({ query: 'My Session', scope: 'all' });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].type).toBe('session');
    });

    it('should index a workspace', () => {
      manager.indexWorkspace('ws-1', 'My Workspace', '/projects');
      const results = manager.search({ query: 'My Workspace', scope: 'all' });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].type).toBe('workspace');
    });
  });

  describe('search', () => {
    beforeEach(() => {
      manager.indexMessage('sess-1', 'msg-1', 'Authentication flow using JWT tokens', Date.now());
      manager.indexMessage('sess-1', 'msg-2', 'Database migration strategy', Date.now());
      manager.indexMessage('sess-2', 'msg-3', 'JWT token refresh mechanism', Date.now());
      manager.indexSession('sess-1', 'Auth Session', '/project/auth');
      manager.indexWorkspace('ws-1', 'Backend Workspace', '/project');
    });

    it('should return empty results for empty query', () => {
      expect(manager.search({ query: '', scope: 'all' })).toEqual([]);
    });

    it('should return empty results for whitespace-only query', () => {
      expect(manager.search({ query: '   ', scope: 'all' })).toEqual([]);
    });

    it('should find messages by keyword', () => {
      const results = manager.search({ query: 'JWT', scope: 'all' });
      expect(results.length).toBe(2);
      expect(results.every(r => r.type === 'message')).toBe(true);
    });

    it('should find messages by multiple keywords with higher score', () => {
      const results = manager.search({ query: 'JWT token', scope: 'all' });
      expect(results.length).toBeGreaterThan(0);
      // All results should match at least one term
      results.forEach(r => {
        expect(r.matchScore).toBeGreaterThan(0);
      });
    });

    it('should include a snippet around the match', () => {
      const results = manager.search({ query: 'Authentication', scope: 'all' });
      expect(results[0].snippet).toContain('Authentication');
    });

    it('should sort by matchScore then timestamp', () => {
      const results = manager.search({ query: 'JWT token', scope: 'all' });
      for (let i = 1; i < results.length; i++) {
        if (results[i].matchScore === results[i - 1].matchScore) {
          expect(results[i].timestamp).toBeLessThanOrEqual(results[i - 1].timestamp);
        } else {
          expect(results[i].matchScore).toBeLessThan(results[i - 1].matchScore);
        }
      }
    });

    it('should limit results to 50', () => {
      for (let i = 0; i < 60; i++) {
        manager.indexMessage('sess-1', `msg-bulk-${i}`, `test keyword number ${i}`, Date.now());
      }
      const results = manager.search({ query: 'test keyword', scope: 'all' });
      expect(results.length).toBeLessThanOrEqual(50);
    });
  });

  describe('search filters', () => {
    beforeEach(() => {
      manager.indexMessage('sess-1', 'msg-1', 'Alpha message', Date.now());
      manager.indexSession('sess-1', 'Alpha Session', '/project');
      manager.indexWorkspace('ws-1', 'Alpha Workspace', '/project');
    });

    it('should filter by type', () => {
      const results = manager.search({
        query: 'Alpha',
        scope: 'all',
        filters: { type: 'message' },
      });
      expect(results.every(r => r.type === 'message')).toBe(true);
    });

    it('should filter by sessionId', () => {
      manager.indexMessage('sess-2', 'msg-2', 'Alpha other', Date.now());
      const results = manager.search({
        query: 'Alpha',
        scope: 'all',
        filters: { sessionId: 'sess-1' },
      });
      expect(results.every(r => r.sessionId === 'sess-1')).toBe(true);
    });

    it('should filter by workspaceId', () => {
      manager.indexWorkspace('ws-2', 'Alpha Other WS', '/other');
      const results = manager.search({
        query: 'Alpha',
        scope: 'all',
        filters: { workspaceId: 'ws-1' },
      });
      expect(results.every(r => r.workspaceId === 'ws-1')).toBe(true);
    });

    it('should filter by date range', () => {
      const now = Date.now();
      manager.indexMessage('sess-1', 'msg-old', 'old Alpha data', now - 100_000);
      const results = manager.search({
        query: 'Alpha',
        scope: 'all',
        filters: { dateRange: { from: now - 50_000, to: now + 50_000 } },
      });
      // msg-old should be excluded
      expect(results.every(r => r.id !== 'msg-old')).toBe(true);
    });

    it('should filter by scope session', () => {
      const results = manager.search({ query: 'Alpha', scope: 'session' });
      expect(results.every(r => r.sessionId !== undefined)).toBe(true);
    });

    it('should filter by scope workspace', () => {
      const results = manager.search({ query: 'Alpha', scope: 'workspace' });
      expect(results.every(r => r.workspaceId !== undefined)).toBe(true);
    });
  });

  describe('templates', () => {
    it('should have 4 built-in templates', () => {
      const templates = manager.listTemplates();
      expect(templates).toHaveLength(4);
      const names = templates.map(t => t.name);
      expect(names).toContain('Code Review');
      expect(names).toContain('Bug Fix');
      expect(names).toContain('Feature Development');
      expect(names).toContain('Refactoring');
    });

    it('should create a custom template', () => {
      const template = manager.createTemplate(
        'My Template',
        'Custom template',
        'custom',
        ['Step 1', 'Step 2'],
        ['tag1'],
      );
      expect(template.id).toBeDefined();
      expect(template.name).toBe('My Template');
      expect(template.category).toBe('custom');
      expect(template.usageCount).toBe(0);
    });

    it('should list templates by category', () => {
      const codeReview = manager.listTemplates('code_review');
      expect(codeReview).toHaveLength(1);
      expect(codeReview[0].name).toBe('Code Review');
    });

    it('should get a template by id', () => {
      const templates = manager.listTemplates();
      const found = manager.getTemplate(templates[0].id);
      expect(found).not.toBeNull();
      expect(found!.name).toBe(templates[0].name);
    });

    it('should return null for non-existent template', () => {
      expect(manager.getTemplate('nope')).toBeNull();
    });

    it('should delete a template', () => {
      const template = manager.createTemplate('ToDelete', 'desc', 'custom', [], []);
      expect(manager.deleteTemplate(template.id)).toBe(true);
      expect(manager.getTemplate(template.id)).toBeNull();
    });

    it('should increment usage count when using a template', () => {
      const templates = manager.listTemplates();
      const id = templates[0].id;

      manager.useTemplate(id);
      manager.useTemplate(id);
      manager.useTemplate(id);

      const updated = manager.getTemplate(id);
      expect(updated!.usageCount).toBe(3);
    });

    it('should emit template:used event', () => {
      const handler = vi.fn();
      manager.on('template:used', handler);

      const templates = manager.listTemplates();
      manager.useTemplate(templates[0].id);

      expect(handler).toHaveBeenCalledOnce();
    });

    it('should return null when using non-existent template', () => {
      expect(manager.useTemplate('nope')).toBeNull();
    });
  });
});
