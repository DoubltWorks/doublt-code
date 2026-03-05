import type { ConnectionState } from '../hooks/useWebSocket';
import type { WorkspaceListItem } from '@doublt/shared';

interface ToolbarProps {
  connectionState: ConnectionState;
  onNewSession: () => void;
  onSplitH: () => void;
  onSplitV: () => void;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  activeWorkspace: WorkspaceListItem | null;
  onOpenWorkspaces: () => void;
  approvalPendingCount: number;
  onOpenApprovals: () => void;
}

export function Toolbar({
  connectionState,
  onNewSession,
  onSplitH,
  onSplitV,
  onToggleSidebar,
  sidebarOpen,
  activeWorkspace,
  onOpenWorkspaces,
  approvalPendingCount,
  onOpenApprovals,
}: ToolbarProps) {
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
      <span style={{ fontWeight: 600, marginRight: 4, color: 'var(--accent)' }}>doublt</span>

      {/* Workspace selector */}
      <button
        onClick={onOpenWorkspaces}
        title="Switch workspace"
        style={{
          padding: '3px 8px',
          fontSize: 12,
          background: 'var(--bg-surface)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>W:</span>
        <span>{activeWorkspace?.name || 'default'}</span>
        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>v</span>
      </button>

      <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 2px' }} />

      <button onClick={onNewSession} title="New Session (Ctrl+B c)">
        + Session
      </button>
      <button onClick={onSplitH} title="Split Horizontal">
        Split H
      </button>
      <button onClick={onSplitV} title="Split Vertical">
        Split V
      </button>

      <div style={{ flex: 1 }} />

      {/* Approval bell — opens sidebar with approvals panel expanded */}
      {approvalPendingCount > 0 && (
        <button
          onClick={onOpenApprovals}
          title={`${approvalPendingCount} pending approvals`}
          style={{
            padding: '2px 8px',
            fontSize: 11,
            background: 'rgba(243, 139, 168, 0.15)',
            color: 'var(--red)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span>!</span>
          <span>{approvalPendingCount}</span>
        </button>
      )}

      {/* Sidebar toggle */}
      <button
        onClick={onToggleSidebar}
        title={sidebarOpen ? 'Hide sidebar (Ctrl+B d)' : 'Show sidebar (Ctrl+B d)'}
        style={{
          padding: '2px 8px',
          fontSize: 11,
          background: sidebarOpen ? 'var(--bg-surface)' : 'transparent',
          color: 'var(--text-muted)',
        }}
      >
        Panel
      </button>

      {/* Connection indicator */}
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
