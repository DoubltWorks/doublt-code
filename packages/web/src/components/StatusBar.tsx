import type { ConnectionState } from '../hooks/useWebSocket';
import type { SessionInfo } from '../hooks/useSessionManager';

interface StatusBarProps {
  connectionState: ConnectionState;
  serverUrl: string;
  activeSession: SessionInfo | undefined;
}

export function StatusBar({ connectionState, serverUrl, activeSession }: StatusBarProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '2px 12px',
        background: connectionState === 'connected' ? 'var(--accent)' : 'var(--red)',
        color: 'var(--bg-primary)',
        fontSize: 12,
        fontWeight: 500,
        minHeight: 22,
      }}
    >
      <span>
        {connectionState === 'connected' ? 'Connected' : connectionState} | {serverUrl}
      </span>

      {activeSession && (
        <span>
          {activeSession.name} | {activeSession.cwd || '~'}
          {activeSession.contextUsage > 0 && ` | ctx: ${Math.round(activeSession.contextUsage * 100)}%`}
        </span>
      )}
    </div>
  );
}
