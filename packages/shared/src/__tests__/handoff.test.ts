import { describe, it, expect } from 'vitest';
import { generateHandoffMd, parseHandoffMd } from '../utils/handoff.js';
import { makeHandoffData } from './fixtures/index.js';

describe('Handoff Utilities', () => {
  describe('generateHandoffMd', () => {
    it('should start with the handoff header', () => {
      const md = generateHandoffMd(makeHandoffData());
      expect(md.startsWith('# Session Handoff')).toBe(true);
    });

    it('should include the parent session ID in the header quote', () => {
      const data = makeHandoffData({ parentSessionId: 'abc-123' });
      const md = generateHandoffMd(data);
      expect(md).toContain('`abc-123`');
    });

    it('should include the summary section', () => {
      const data = makeHandoffData({ summary: 'Building REST API' });
      const md = generateHandoffMd(data);
      expect(md).toContain('## Summary');
      expect(md).toContain('Building REST API');
    });

    it('should render current tasks as checklist items', () => {
      const data = makeHandoffData({ currentTasks: ['Task A', 'Task B'] });
      const md = generateHandoffMd(data);
      expect(md).toContain('## Current Tasks');
      expect(md).toContain('- [ ] Task A');
      expect(md).toContain('- [ ] Task B');
    });

    it('should render decisions as bullet list', () => {
      const data = makeHandoffData({ decisions: ['Use TypeScript', 'Deploy to AWS'] });
      const md = generateHandoffMd(data);
      expect(md).toContain('## Key Decisions');
      expect(md).toContain('- Use TypeScript');
      expect(md).toContain('- Deploy to AWS');
    });

    it('should render relevant files with backticks', () => {
      const data = makeHandoffData({ relevantFiles: ['src/main.ts', 'package.json'] });
      const md = generateHandoffMd(data);
      expect(md).toContain('## Relevant Files');
      expect(md).toContain('- `src/main.ts`');
      expect(md).toContain('- `package.json`');
    });

    it('should include blockers section only when non-empty', () => {
      const noBlockers = generateHandoffMd(makeHandoffData({ blockers: [] }));
      expect(noBlockers).not.toContain('## Blockers');

      const withBlockers = generateHandoffMd(makeHandoffData({ blockers: ['API key missing'] }));
      expect(withBlockers).toContain('## Blockers');
      expect(withBlockers).toContain('- API key missing');
    });

    it('should include additional context when provided', () => {
      const data = makeHandoffData({ additionalContext: 'Custom context here' });
      const md = generateHandoffMd(data);
      expect(md).toContain('## Additional Context');
      expect(md).toContain('Custom context here');
    });

    it('should omit additional context section when empty', () => {
      const data = makeHandoffData({ additionalContext: '' });
      const md = generateHandoffMd(data);
      expect(md).not.toContain('## Additional Context');
    });

    it('should include metadata JSON block', () => {
      const data = makeHandoffData({ parentSessionId: 'p-1', timestamp: 1700000000000 });
      const md = generateHandoffMd(data);
      expect(md).toContain('## Metadata');
      expect(md).toContain('```json');
      expect(md).toContain('"parentSessionId": "p-1"');
      expect(md).toContain('"timestamp": 1700000000000');
    });
  });

  describe('parseHandoffMd', () => {
    it('should return null if content does not start with header', () => {
      expect(parseHandoffMd('Not a handoff')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(parseHandoffMd('')).toBeNull();
    });

    it('should parse the summary section', () => {
      const data = makeHandoffData({ summary: 'Working on auth module' });
      const md = generateHandoffMd(data);
      const parsed = parseHandoffMd(md);
      expect(parsed).not.toBeNull();
      expect(parsed!.summary).toBe('Working on auth module');
    });

    it('should parse current tasks list', () => {
      const data = makeHandoffData({ currentTasks: ['Fix login', 'Add tests'] });
      const md = generateHandoffMd(data);
      const parsed = parseHandoffMd(md);
      expect(parsed!.currentTasks).toEqual(['Fix login', 'Add tests']);
    });

    it('should parse decisions list', () => {
      const data = makeHandoffData({ decisions: ['Use JWT'] });
      const md = generateHandoffMd(data);
      const parsed = parseHandoffMd(md);
      expect(parsed!.decisions).toEqual(['Use JWT']);
    });

    it('should parse relevant files (strip backticks)', () => {
      const data = makeHandoffData({ relevantFiles: ['src/auth.ts'] });
      const md = generateHandoffMd(data);
      const parsed = parseHandoffMd(md);
      expect(parsed!.relevantFiles).toEqual(['src/auth.ts']);
    });

    it('should parse metadata (parentSessionId and timestamp)', () => {
      const data = makeHandoffData({ parentSessionId: 'parent-x', timestamp: 1700000000000 });
      const md = generateHandoffMd(data);
      const parsed = parseHandoffMd(md);
      expect(parsed!.parentSessionId).toBe('parent-x');
      expect(parsed!.timestamp).toBe(1700000000000);
    });
  });

  describe('roundtrip: generate -> parse', () => {
    it('should preserve all fields through roundtrip', () => {
      const original = makeHandoffData({
        parentSessionId: 'sess-round',
        timestamp: 1700000000000,
        summary: 'Roundtrip test',
        currentTasks: ['Task 1', 'Task 2', 'Task 3'],
        decisions: ['Decision A', 'Decision B'],
        relevantFiles: ['file1.ts', 'file2.ts'],
        blockers: ['Blocker 1'],
        additionalContext: 'Extra context for roundtrip',
      });

      const md = generateHandoffMd(original);
      const parsed = parseHandoffMd(md);

      expect(parsed).not.toBeNull();
      expect(parsed!.parentSessionId).toBe(original.parentSessionId);
      expect(parsed!.timestamp).toBe(original.timestamp);
      expect(parsed!.summary).toBe(original.summary);
      expect(parsed!.currentTasks).toEqual(original.currentTasks);
      expect(parsed!.decisions).toEqual(original.decisions);
      expect(parsed!.relevantFiles).toEqual(original.relevantFiles);
      expect(parsed!.blockers).toEqual(original.blockers);
      expect(parsed!.additionalContext).toBe(original.additionalContext);
    });

    it('should handle empty lists gracefully', () => {
      const original = makeHandoffData({
        currentTasks: [],
        decisions: [],
        relevantFiles: [],
        blockers: [],
        additionalContext: '',
      });

      const md = generateHandoffMd(original);
      const parsed = parseHandoffMd(md);

      expect(parsed).not.toBeNull();
      expect(parsed!.currentTasks).toEqual([]);
      expect(parsed!.decisions).toEqual([]);
      expect(parsed!.relevantFiles).toEqual([]);
    });
  });
});
