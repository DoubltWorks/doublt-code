import type { TimelineEntry, DigestSummary } from '@doublt/shared';
import { EmptyState } from './EmptyState';

interface ActivityPanelProps {
  entries: TimelineEntry[];
  digest: DigestSummary | null;
}

const EVENT_ICONS: Record<string, string> = {
  message: '>',
  tool_use: '*',
  error: '!',
  handoff: '->',
  command: '$',
  commit: '#',
};

const EVENT_COLORS: Record<string, string> = {
  message: 'var(--accent)',
  tool_use: 'var(--yellow)',
  error: 'var(--red)',
  handoff: 'var(--green)',
  command: 'var(--text-secondary)',
  commit: 'var(--green)',
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ActivityPanel({ entries, digest }: ActivityPanelProps) {
  if (entries.length === 0 && !digest) {
    return <EmptyState icon="~" message="No activity yet" />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Digest summary */}
      {digest && (
        <div
          style={{
            padding: '6px 8px',
            background: 'var(--bg-surface)',
            borderRadius: 4,
            fontSize: 11,
            marginBottom: 4,
          }}
        >
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
            <span>
              <span style={{ color: 'var(--text-muted)' }}>Sessions: </span>
              <span style={{ color: 'var(--accent)' }}>{digest.sessionsActive}</span>
            </span>
            <span>
              <span style={{ color: 'var(--text-muted)' }}>Messages: </span>
              <span style={{ color: 'var(--accent)' }}>{digest.messagesCount}</span>
            </span>
            <span>
              <span style={{ color: 'var(--text-muted)' }}>Tools: </span>
              <span style={{ color: 'var(--yellow)' }}>{digest.toolUseCount}</span>
            </span>
            {digest.errorsCount > 0 && (
              <span>
                <span style={{ color: 'var(--text-muted)' }}>Errors: </span>
                <span style={{ color: 'var(--red)' }}>{digest.errorsCount}</span>
              </span>
            )}
          </div>
          {digest.summary && (
            <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>{digest.summary}</div>
          )}
        </div>
      )}

      {/* Timeline entries */}
      {/* key uses timestamp-idx because TimelineEntry has no unique id field */}
      {entries.slice(0, 30).map((entry, idx) => (
        <div
          key={`${entry.timestamp}-${idx}`}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 6,
            fontSize: 11,
            padding: '2px 0',
          }}
        >
          <span style={{ color: 'var(--text-muted)', fontSize: 10, flexShrink: 0, width: 40 }}>
            {formatTime(entry.timestamp)}
          </span>
          <span
            style={{
              color: EVENT_COLORS[entry.type] || 'var(--text-muted)',
              flexShrink: 0,
              width: 16,
              textAlign: 'center',
              fontSize: 10,
            }}
          >
            {EVENT_ICONS[entry.type] || '.'}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: 'var(--text-primary)', lineHeight: 1.3 }}>{entry.title}</div>
            {entry.detail && (
              <div
                style={{
                  color: 'var(--text-muted)',
                  fontSize: 10,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {entry.detail}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
