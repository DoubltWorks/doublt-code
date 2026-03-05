import type { SessionInfo } from '../../hooks/useSessionManager';
import { OverlayBackdrop } from './OverlayBackdrop';
import { timeAgo } from '../../utils/time';

interface SessionListOverlayProps {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onArchive: (id: string) => void;
  onClose: () => void;
}

export function SessionListOverlay({
  sessions,
  activeSessionId,
  onSelect,
  onArchive,
  onClose,
}: SessionListOverlayProps) {
  return (
    <OverlayBackdrop onClose={onClose} width={500}>
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        Sessions ({sessions.length})
      </div>

      <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
        {sessions.map((s) => {
          const isActive = s.id === activeSessionId;
          const ctxPct = Math.round(s.contextUsage * 100);
          return (
            <div
              key={s.id}
              onClick={() => {
                onSelect(s.id);
                onClose();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 16px',
                cursor: 'pointer',
                background: isActive ? 'var(--bg-surface)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--accent)' : 'var(--text-primary)' }}>
                    {s.index}: {s.name}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      padding: '1px 5px',
                      borderRadius: 4,
                      background:
                        s.status === 'active'
                          ? 'rgba(166, 227, 161, 0.15)'
                          : 'var(--bg-hover)',
                      color:
                        s.status === 'active'
                          ? 'var(--green)'
                          : 'var(--text-muted)',
                    }}
                  >
                    {s.status}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {s.cwd || '~'} | ctx: {ctxPct}% | {timeAgo(s.lastActivityAt)}
                </div>
              </div>

              {sessions.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onArchive(s.id);
                  }}
                  style={{ fontSize: 10, padding: '2px 6px', background: 'transparent', color: 'var(--red)' }}
                >
                  Archive
                </button>
              )}
            </div>
          );
        })}
      </div>
    </OverlayBackdrop>
  );
}
