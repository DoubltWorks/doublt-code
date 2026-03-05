import type { SessionInfo } from '../hooks/useSessionManager';

interface SessionTabsProps {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onArchiveSession?: (id: string) => void;
  workspaceName?: string;
}

export function SessionTabs({ sessions, activeSessionId, onSelectSession, onArchiveSession, workspaceName }: SessionTabsProps) {
  if (sessions.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        minHeight: 28,
        gap: 2,
        overflowX: 'auto',
      }}
    >
      {/* Workspace filter indicator */}
      {workspaceName && (
        <span
          style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            padding: '2px 8px',
            borderRight: '1px solid var(--border)',
            marginRight: 4,
            whiteSpace: 'nowrap',
          }}
        >
          {workspaceName}
        </span>
      )}

      {sessions.map((session, idx) => {
        const isActive = session.id === activeSessionId;
        return (
          <button
            key={session.id}
            onClick={() => onSelectSession(session.id)}
            style={{
              background: isActive ? 'var(--bg-surface)' : 'transparent',
              color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
              borderRadius: '4px 4px 0 0',
              padding: '3px 12px',
              fontSize: 12,
              fontWeight: isActive ? 600 : 400,
              borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              whiteSpace: 'nowrap',
            }}
          >
            {idx}:{session.name}
            {session.contextUsage > 0.5 && (
              <span
                style={{
                  marginLeft: 6,
                  fontSize: 10,
                  color: session.contextUsage > 0.8 ? 'var(--red)' : 'var(--yellow)',
                }}
              >
                {Math.round(session.contextUsage * 100)}%
              </span>
            )}
            {onArchiveSession && sessions.length > 1 && (
              <span
                aria-label={`Close session ${session.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onArchiveSession(session.id);
                }}
                style={{
                  marginLeft: 6,
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0 2px',
                  lineHeight: 1,
                }}
              >
                x
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
