/**
 * HANDOFF.md generation and parsing utilities.
 *
 * When a session's context approaches the limit, the system generates
 * a HANDOFF.md file that captures the essential state needed to continue
 * work in a new session. This is inspired by Happy Coder's auto-handoff
 * but enhanced with structured metadata.
 */

export interface HandoffData {
  parentSessionId: string;
  timestamp: number;
  /** High-level summary of what was being worked on */
  summary: string;
  /** Current task status and what remains */
  currentTasks: string[];
  /** Key decisions made during the session */
  decisions: string[];
  /** Files that were modified or are relevant */
  relevantFiles: string[];
  /** Any errors or blockers encountered */
  blockers: string[];
  /** Free-form context that should carry over */
  additionalContext: string;
}

const HANDOFF_HEADER = '# Session Handoff';
const SECTION_MARKERS = {
  summary: '## Summary',
  tasks: '## Current Tasks',
  decisions: '## Key Decisions',
  files: '## Relevant Files',
  blockers: '## Blockers',
  context: '## Additional Context',
  metadata: '## Metadata',
} as const;

export function generateHandoffMd(data: HandoffData): string {
  const lines: string[] = [
    HANDOFF_HEADER,
    '',
    `> Auto-generated handoff from session \`${data.parentSessionId}\` at ${new Date(data.timestamp).toISOString()}`,
    '',
    SECTION_MARKERS.summary,
    '',
    data.summary,
    '',
    SECTION_MARKERS.tasks,
    '',
    ...data.currentTasks.map(t => `- [ ] ${t}`),
    '',
    SECTION_MARKERS.decisions,
    '',
    ...data.decisions.map(d => `- ${d}`),
    '',
    SECTION_MARKERS.files,
    '',
    ...data.relevantFiles.map(f => `- \`${f}\``),
    '',
  ];

  if (data.blockers.length > 0) {
    lines.push(SECTION_MARKERS.blockers, '', ...data.blockers.map(b => `- ${b}`), '');
  }

  if (data.additionalContext) {
    lines.push(SECTION_MARKERS.context, '', data.additionalContext, '');
  }

  lines.push(
    SECTION_MARKERS.metadata,
    '',
    '```json',
    JSON.stringify({ parentSessionId: data.parentSessionId, timestamp: data.timestamp }, null, 2),
    '```',
    ''
  );

  return lines.join('\n');
}

export function parseHandoffMd(content: string): HandoffData | null {
  if (!content.startsWith(HANDOFF_HEADER)) return null;

  const getSection = (marker: string): string => {
    const idx = content.indexOf(marker);
    if (idx === -1) return '';
    const start = idx + marker.length;
    const nextSection = Object.values(SECTION_MARKERS).find(
      m => m !== marker && content.indexOf(m, start) !== -1
    );
    const end = nextSection ? content.indexOf(nextSection, start) : content.length;
    return content.slice(start, end).trim();
  };

  const parseList = (section: string): string[] =>
    section
      .split('\n')
      .map(l => l.replace(/^-\s*(\[.\]\s*)?/, '').trim())
      .filter(Boolean);

  const parseFileList = (section: string): string[] =>
    section
      .split('\n')
      .map(l => l.replace(/^-\s*`?([^`]*)`?\s*$/, '$1').trim())
      .filter(Boolean);

  let metadata = { parentSessionId: '', timestamp: 0 };
  const metaSection = getSection(SECTION_MARKERS.metadata);
  const jsonMatch = metaSection.match(/```json\n([\s\S]*?)\n```/);
  if (jsonMatch) {
    try {
      metadata = JSON.parse(jsonMatch[1]);
    } catch { /* use defaults */ }
  }

  return {
    parentSessionId: metadata.parentSessionId,
    timestamp: metadata.timestamp,
    summary: getSection(SECTION_MARKERS.summary),
    currentTasks: parseList(getSection(SECTION_MARKERS.tasks)),
    decisions: parseList(getSection(SECTION_MARKERS.decisions)),
    relevantFiles: parseFileList(getSection(SECTION_MARKERS.files)),
    blockers: parseList(getSection(SECTION_MARKERS.blockers)),
    additionalContext: getSection(SECTION_MARKERS.context),
  };
}
