import type { ClaudeSessionStatus } from '../../hooks/useClaudeStatus';
import { EmptyState } from './EmptyState';

interface ClaudeStatusPanelProps {
  statuses: ClaudeSessionStatus[];
  activeSessionId: string | null;
  onStart: (sessionId: string) => void;
  onStop: (sessionId: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  running: 'var(--status-running)',
  idle: 'var(--status-idle)',
  stopped: 'var(--status-idle)',
  crashed: 'var(--status-crashed)',
  error: 'var(--status-crashed)',
  budget_paused: 'var(--yellow)',
};

export function ClaudeStatusPanel({
  statuses,
  activeSessionId,
  onStart,
  onStop,
}: ClaudeStatusPanelProps) {
  if (statuses.length === 0) {
    return <EmptyState icon=">" message="No Claude sessions" />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {statuses.map((s) => {
        const isActive = s.sessionId === activeSessionId;
        const isRunning = s.status === 'running';
        return (
          <div
            key={s.sessionId}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 6px',
              borderRadius: 4,
              background: isActive ? 'var(--bg-surface)' : 'transparent',
              fontSize: 11,
            }}
          >
            {/* Status dot */}
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: STATUS_COLORS[s.status] || 'var(--text-muted)',
                flexShrink: 0,
              }}
            />

            {/* Session ID (truncated) */}
            <span
              style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}
            >
              {s.sessionId.slice(0, 8)}
            </span>

            {/* Status label */}
            <span
              style={{
                fontSize: 10,
                color: STATUS_COLORS[s.status] || 'var(--text-muted)',
                flexShrink: 0,
              }}
            >
              {s.status}
            </span>

            {/* Restart count */}
            {s.restartCount > 0 && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                x{s.restartCount}
              </span>
            )}

            {/* Start/Stop button */}
            <button
              onClick={() => (isRunning ? onStop(s.sessionId) : onStart(s.sessionId))}
              style={{
                padding: '1px 6px',
                fontSize: 10,
                background: isRunning ? 'rgba(243, 139, 168, 0.15)' : 'rgba(166, 227, 161, 0.15)',
                color: isRunning ? 'var(--red)' : 'var(--green)',
                borderRadius: 3,
                flexShrink: 0,
              }}
            >
              {isRunning ? 'Stop' : 'Start'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
