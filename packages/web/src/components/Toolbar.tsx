import type { ConnectionState } from '../hooks/useWebSocket';

interface ToolbarProps {
  connectionState: ConnectionState;
  onNewSession: () => void;
  onSplitH: () => void;
  onSplitV: () => void;
}

export function Toolbar({ connectionState, onNewSession, onSplitH, onSplitV }: ToolbarProps) {
  const stateColor =
    connectionState === 'connected'
      ? 'var(--green)'
      : connectionState === 'reconnecting' || connectionState === 'connecting'
        ? 'var(--yellow)'
        : 'var(--red)';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 12px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        minHeight: 32,
      }}
    >
      <span style={{ fontWeight: 600, marginRight: 8, color: 'var(--accent)' }}>doublt</span>

      <button onClick={onNewSession} title="New Session">
        + Session
      </button>
      <button onClick={onSplitH} title="Split Horizontal">
        Split H
      </button>
      <button onClick={onSplitV} title="Split Vertical">
        Split V
      </button>

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: stateColor,
          }}
        />
        <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{connectionState}</span>
      </div>
    </div>
  );
}
