import { EventEmitter } from 'events';
import crypto from 'crypto';
import type { SearchQuery, SearchResult, SearchResultType, SessionTemplate } from '@doublt/shared';

interface IndexEntry {
  id: string;
  type: SearchResultType;
  text: string;
  title: string;
  timestamp: number;
  sessionId?: string;
  workspaceId?: string;
}

export class SearchManager extends EventEmitter {
  private index: Map<string, IndexEntry> = new Map();
  private templates: Map<string, SessionTemplate> = new Map();

  constructor() {
    super();
    this.createBuiltinTemplates();
  }

  private createBuiltinTemplates(): void {
    this.createTemplate(
      'Code Review',
      'Systematically review code changes for quality and correctness',
      'code_review',
      [
        'Review the following code changes',
        'Check for bugs, security issues, and performance',
        'Suggest improvements',
      ],
      ['review', 'quality'],
    );

    this.createTemplate(
      'Bug Fix',
      'Investigate and resolve a reported bug',
      'bug_fix',
      [
        'Describe the bug and expected behavior',
        'Investigate root cause',
        'Implement fix and add tests',
      ],
      ['bug', 'fix', 'debug'],
    );

    this.createTemplate(
      'Feature Development',
      'Plan and implement a new feature end-to-end',
      'feature_dev',
      [
        'Define requirements and acceptance criteria',
        'Design the implementation approach',
        'Implement the feature',
      ],
      ['feature', 'implementation'],
    );

    this.createTemplate(
      'Refactoring',
      'Improve code structure without changing behavior',
      'refactoring',
      [
        'Identify code smells and areas for improvement',
        'Plan refactoring steps',
        'Refactor while maintaining behavior',
      ],
      ['refactor', 'cleanup'],
    );
  }

  indexMessage(sessionId: string, messageId: string, content: string, timestamp: number): void {
    const entry: IndexEntry = {
      id: messageId,
      type: 'message',
      text: content,
      title: content.slice(0, 60),
      timestamp,
      sessionId,
    };
    this.index.set(messageId, entry);
    this.emit('search:indexed', { type: 'message', id: messageId });
  }

  indexSession(sessionId: string, name: string, cwd: string): void {
    const entry: IndexEntry = {
      id: sessionId,
      type: 'session',
      text: `${name} ${cwd}`,
      title: name,
      timestamp: Date.now(),
      sessionId,
    };
    this.index.set(sessionId, entry);
    this.emit('search:indexed', { type: 'session', id: sessionId });
  }

  indexWorkspace(workspaceId: string, name: string, cwd: string): void {
    const entry: IndexEntry = {
      id: workspaceId,
      type: 'workspace',
      text: `${name} ${cwd}`,
      title: name,
      timestamp: Date.now(),
      workspaceId,
    };
    this.index.set(workspaceId, entry);
    this.emit('search:indexed', { type: 'workspace', id: workspaceId });
  }

  search(query: SearchQuery): SearchResult[] {
    const terms = query.query.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];

    const now = Date.now();
    const results: SearchResult[] = [];

    for (const entry of this.index.values()) {
      // Filter by type
      if (query.filters?.type && entry.type !== query.filters.type) continue;

      // Filter by sessionId
      if (query.filters?.sessionId && entry.sessionId !== query.filters.sessionId) continue;

      // Filter by workspaceId
      if (query.filters?.workspaceId && entry.workspaceId !== query.filters.workspaceId) continue;

      // Filter by date range
      if (query.filters?.dateRange) {
        if (entry.timestamp < query.filters.dateRange.from || entry.timestamp > query.filters.dateRange.to) continue;
      }

      // Filter by scope
      if (query.scope === 'session' && !entry.sessionId) continue;
      if (query.scope === 'workspace' && !entry.workspaceId) continue;

      const lowerText = entry.text.toLowerCase();
      const matchingTerms = terms.filter((t: string) => lowerText.includes(t));
      if (matchingTerms.length === 0) continue;

      const termScore = matchingTerms.length / terms.length;
      // Recency boost: entries within 1 hour get up to 0.2 boost
      const ageMs = now - entry.timestamp;
      const recencyBoost = Math.max(0, 0.2 * (1 - ageMs / 3_600_000));
      const matchScore = Math.min(1, termScore + recencyBoost);

      // Build snippet around first match
      const firstTerm = matchingTerms[0];
      const idx = lowerText.indexOf(firstTerm);
      const start = Math.max(0, idx - 30);
      const end = Math.min(entry.text.length, idx + 80);
      const snippet = (start > 0 ? '...' : '') + entry.text.slice(start, end) + (end < entry.text.length ? '...' : '');

      results.push({
        type: entry.type,
        id: entry.id,
        title: entry.title,
        snippet,
        matchScore,
        timestamp: entry.timestamp,
        sessionId: entry.sessionId,
        workspaceId: entry.workspaceId,
      });
    }

    results.sort((a, b) => {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      return b.timestamp - a.timestamp;
    });

    return results.slice(0, 50);
  }

  createTemplate(
    name: string,
    description: string,
    category: SessionTemplate['category'],
    prompts: string[],
    tags: string[],
    cwdPattern?: string,
  ): SessionTemplate {
    const template: SessionTemplate = {
      id: crypto.randomUUID().slice(0, 8),
      name,
      description,
      category,
      prompts,
      tags,
      createdAt: Date.now(),
      usageCount: 0,
      ...(cwdPattern !== undefined ? { cwdPattern } : {}),
    };
    this.templates.set(template.id, template);
    this.emit('template:created', template);
    return template;
  }

  listTemplates(category?: SessionTemplate['category']): SessionTemplate[] {
    const all = Array.from(this.templates.values());
    if (!category) return all;
    return all.filter((t) => t.category === category);
  }

  getTemplate(id: string): SessionTemplate | null {
    return this.templates.get(id) ?? null;
  }

  deleteTemplate(id: string): boolean {
    return this.templates.delete(id);
  }

  useTemplate(id: string): SessionTemplate | null {
    const template = this.templates.get(id);
    if (!template) return null;
    template.usageCount += 1;
    this.emit('template:used', template);
    return template;
  }
}
