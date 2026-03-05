import type { ConnectionState } from '../hooks/useWebSocket';
import type { SessionInfo } from '../hooks/useSessionManager';
import type { GitStatus } from '@doublt/shared';

interface StatusBarEnhancedProps {
  connectionState: ConnectionState;
  activeSession: SessionInfo | undefined;
  gitStatus: GitStatus | null;
  totalCostUsd: number;
  claudeStatus: string;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function StatusBarEnhanced({
  connectionState,
  activeSession,
  gitStatus,
  totalCostUsd,
  claudeStatus,
  sidebarOpen,
  onToggleSidebar,
}: StatusBarEnhancedProps) {
  const isConnected = connectionState === 'connected';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '2px 12px',
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border)',
        color: 'var(--text-secondary)',
        fontSize: 11,
        minHeight: 24,
        gap: 12,
      }}
    >
      {/* Left: connection + git branch + session */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: isConnected ? 'var(--green)' : 'var(--red)',
              display: 'inline-block',
            }}
          />
          <span style={{ color: isConnected ? 'var(--green)' : 'var(--red)' }}>
            {isConnected ? 'Connected' : connectionState}
          </span>
        </span>

        {gitStatus && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <span style={{ color: 'var(--text-muted)' }}>|</span>
            <span style={{ color: 'var(--accent)' }}>{gitStatus.branch}</span>
            {(gitStatus.ahead > 0 || gitStatus.behind > 0) && (
              <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                {gitStatus.ahead > 0 && `+${gitStatus.ahead}`}
                {gitStatus.behind > 0 && `-${gitStatus.behind}`}
              </span>
            )}
          </span>
        )}

        {activeSession && (
          <span
            style={{
              color: 'var(--text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            | {activeSession.name} {activeSession.cwd && `- ${activeSession.cwd}`}
          </span>
        )}
      </div>

      {/* Center: keybinding hints */}
      <div
        style={{
          color: 'var(--text-muted)',
          fontSize: 10,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        Ctrl+B ? Help | Ctrl+K Command
      </div>

      {/* Right: cost + claude + sidebar toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {totalCostUsd > 0 && (
          <span style={{ color: 'var(--yellow)' }}>
            ${totalCostUsd.toFixed(2)}
          </span>
        )}

        {claudeStatus && claudeStatus !== 'unknown' && (
          <span
            style={{
              color:
                claudeStatus === 'running'
                  ? 'var(--green)'
                  : claudeStatus === 'crashed' || claudeStatus === 'error'
                    ? 'var(--red)'
                    : 'var(--text-muted)',
            }}
          >
            Claude: {claudeStatus}
          </span>
        )}

        {activeSession && activeSession.contextUsage > 0 && (
          <span
            style={{
              color:
                activeSession.contextUsage > 0.8
                  ? 'var(--red)'
                  : activeSession.contextUsage > 0.5
                    ? 'var(--yellow)'
                    : 'var(--text-muted)',
            }}
          >
            ctx: {Math.round(activeSession.contextUsage * 100)}%
          </span>
        )}

        <button
          onClick={onToggleSidebar}
          title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          style={{
            padding: '1px 6px',
            fontSize: 11,
            background: sidebarOpen ? 'var(--bg-surface)' : 'transparent',
            color: 'var(--text-muted)',
            borderRadius: 3,
          }}
        >
          {sidebarOpen ? '\u25B6|' : '|\u25C0'}
        </button>
      </div>
    </div>
  );
}
