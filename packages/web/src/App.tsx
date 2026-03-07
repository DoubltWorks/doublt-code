import { useMemo, useCallback, useRef } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { useSessionManager } from './hooks/useSessionManager';
import { usePaneLayout } from './hooks/usePaneLayout';
import { useSidebar } from './hooks/useSidebar';
import { useGitStatus } from './hooks/useGitStatus';
import { useCostTracker } from './hooks/useCostTracker';
import { useClaudeStatus } from './hooks/useClaudeStatus';
import { useWorkspaceManager } from './hooks/useWorkspaceManager';
import { useOverlay } from './hooks/useOverlay';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useTaskQueue } from './hooks/useTaskQueue';
import { useApprovalQueue } from './hooks/useApprovalQueue';
import { useActivityTimeline } from './hooks/useActivityTimeline';
import { useNotificationToast } from './components/NotificationToast';
import { useTunnelStatus } from './hooks/useTunnelStatus';
import { Toolbar } from './components/Toolbar';
import { SessionTabs } from './components/SessionTabs';
import { PaneContainer } from './components/PaneContainer';
import { StatusBarEnhanced } from './components/StatusBarEnhanced';
import { Sidebar } from './components/Sidebar';
import { PanelAccordion } from './components/panels/PanelAccordion';
import { GitPanel } from './components/panels/GitPanel';
import { CostPanel } from './components/panels/CostPanel';
import { ClaudeStatusPanel } from './components/panels/ClaudeStatusPanel';
import { TaskPanel } from './components/panels/TaskPanel';
import { ApprovalPanel } from './components/panels/ApprovalPanel';
import { ActivityPanel } from './components/panels/ActivityPanel';
import { NotificationToast } from './components/NotificationToast';
import { SessionListOverlay } from './components/overlays/SessionListOverlay';
import { WorkspaceListOverlay } from './components/overlays/WorkspaceListOverlay';
import { HelpOverlay } from './components/overlays/HelpOverlay';
import { PairingOverlay } from './components/overlays/PairingOverlay';
import { CommandPalette, type PaletteCommand } from './components/overlays/CommandPalette';

function getConnectionParams(): { wsUrl: string; token: string } {
  const hash = window.location.hash.slice(1);
  const params = new URLSearchParams(hash);
  const token = params.get('token') ?? '';

  // Determine WebSocket URL from current location
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;

  // Clear token from URL to prevent leakage via browser history/screenshots
  if (token) {
    history.replaceState(null, '', window.location.pathname);
  }

  return { wsUrl, token };
}

export function App() {
  const { wsUrl, token } = useMemo(() => getConnectionParams(), []);
  const { send, connectionState, subscribe } = useWebSocket(wsUrl, token);

  // Session management
  const {
    sessions,
    activeSessionId,
    setActiveSessionId,
    createSession,
    archiveSession,
  } = useSessionManager(send, subscribe, connectionState);

  // Pane layout
  const {
    root,
    activePaneId,
    setActivePaneId,
    splitPane,
    resizePane,
  } = usePaneLayout(activeSessionId ?? '');

  // Sidebar
  const sidebar = useSidebar();

  // Data hooks
  const git = useGitStatus(send, subscribe, connectionState, activeSessionId);
  const cost = useCostTracker(send, subscribe, connectionState);
  const claude = useClaudeStatus(send, subscribe, connectionState);
  const workspace = useWorkspaceManager(send, subscribe, connectionState);
  const taskQueue = useTaskQueue(send, subscribe, connectionState);
  const approval = useApprovalQueue(send, subscribe, connectionState);
  const activity = useActivityTimeline(send, subscribe, connectionState);
  const tunnel = useTunnelStatus(subscribe);
  const { toasts, removeToast } = useNotificationToast(subscribe);

  // Overlay management
  const overlay = useOverlay();

  // Stable refs for sidebar state used in callbacks
  const sidebarRef = useRef(sidebar);
  sidebarRef.current = sidebar;

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId),
    [sessions, activeSessionId],
  );

  const activeClaudeStatus = useMemo(() => {
    const match = claude.statuses.find((s) => s.sessionId === (activeSessionId ?? ''));
    return match?.status ?? 'unknown';
  }, [claude.statuses, activeSessionId]);

  // Session navigation
  const handleNewSession = useCallback(() => {
    createSession(workspace.activeWorkspaceId ?? undefined);
  }, [createSession, workspace.activeWorkspaceId]);

  const handleNextSession = useCallback(() => {
    if (sessions.length < 2 || !activeSessionId) return;
    const idx = sessions.findIndex((s) => s.id === activeSessionId);
    const next = sessions[(idx + 1) % sessions.length];
    setActiveSessionId(next.id);
  }, [sessions, activeSessionId, setActiveSessionId]);

  const handlePrevSession = useCallback(() => {
    if (sessions.length < 2 || !activeSessionId) return;
    const idx = sessions.findIndex((s) => s.id === activeSessionId);
    const prev = sessions[(idx - 1 + sessions.length) % sessions.length];
    setActiveSessionId(prev.id);
  }, [sessions, activeSessionId, setActiveSessionId]);

  const handleSplitH = useCallback(() => {
    if (activeSessionId) {
      splitPane('horizontal', activeSessionId);
    }
  }, [splitPane, activeSessionId]);

  const handleSplitV = useCallback(() => {
    if (activeSessionId) {
      splitPane('vertical', activeSessionId);
    }
  }, [splitPane, activeSessionId]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onNewSession: handleNewSession,
    onNextSession: handleNextSession,
    onPrevSession: handlePrevSession,
    onOpenOverlay: overlay.openOverlay,
    onCloseOverlay: overlay.closeOverlay,
    onToggleSidebar: sidebar.toggle,
    activeOverlay: overlay.activeOverlay,
  });

  const handleOpenWorkspaces = useCallback(() => {
    overlay.openOverlay('workspaceList');
  }, [overlay.openOverlay]);

  const handleOpenApprovals = useCallback(() => {
    if (!sidebarRef.current.isOpen) sidebarRef.current.toggle();
    if (!sidebarRef.current.isPanelExpanded('approvals')) sidebarRef.current.togglePanel('approvals');
  }, []);

  // Command palette commands — use only stable callback refs as deps
  const commands = useMemo<PaletteCommand[]>(() => [
    { id: 'session-new', label: 'New Session', shortcut: 'Ctrl+B c', category: 'Sessions', action: handleNewSession },
    { id: 'session-next', label: 'Next Session', shortcut: 'Ctrl+B n', category: 'Sessions', action: handleNextSession },
    { id: 'session-prev', label: 'Previous Session', shortcut: 'Ctrl+B p', category: 'Sessions', action: handlePrevSession },
    { id: 'session-list', label: 'List Sessions', shortcut: 'Ctrl+B w', category: 'Sessions', action: () => overlay.openOverlay('sessionList') },
    { id: 'split-h', label: 'Split Horizontal', category: 'Layout', action: handleSplitH },
    { id: 'split-v', label: 'Split Vertical', category: 'Layout', action: handleSplitV },
    { id: 'sidebar-toggle', label: 'Toggle Sidebar', shortcut: 'Ctrl+B d', category: 'Layout', action: sidebar.toggle },
    { id: 'workspace-list', label: 'List Workspaces', category: 'Workspaces', action: () => overlay.openOverlay('workspaceList') },
    { id: 'workspace-new', label: 'New Workspace', category: 'Workspaces', action: () => workspace.createWorkspace() },
    { id: 'pair-mobile', label: 'Mobile Pairing', shortcut: 'Ctrl+B m', category: 'Connect', action: () => overlay.openOverlay('pairingQR') },
    { id: 'help', label: 'Keyboard Shortcuts', shortcut: 'Ctrl+B ?', category: 'Help', action: () => overlay.openOverlay('help') },
    { id: 'git-refresh', label: 'Refresh Git Status', category: 'Git', action: git.requestRefresh },
    { id: 'cost-refresh', label: 'Refresh Usage', category: 'Cost', action: cost.requestRefresh },
  ], [handleNewSession, handleNextSession, handlePrevSession, handleSplitH, handleSplitV,
      sidebar.toggle, workspace.createWorkspace, overlay.openOverlay, git.requestRefresh, cost.requestRefresh]);

  // Filter sessions by workspace
  const filteredSessions = useMemo(() => {
    if (!workspace.activeWorkspaceId) return sessions;
    return sessions.filter((s) => s.workspaceId === workspace.activeWorkspaceId);
  }, [sessions, workspace.activeWorkspaceId]);

  const activeWorkspace = useMemo(
    () => workspace.workspaces.find((w) => w.id === workspace.activeWorkspaceId),
    [workspace.workspaces, workspace.activeWorkspaceId],
  );

  return (
    <>
      <Toolbar
        connectionState={connectionState}
        onNewSession={handleNewSession}
        onSplitH={handleSplitH}
        onSplitV={handleSplitV}
        onToggleSidebar={sidebar.toggle}
        sidebarOpen={sidebar.isOpen}
        activeWorkspace={activeWorkspace ?? null}
        onOpenWorkspaces={handleOpenWorkspaces}
        approvalPendingCount={approval.pendingCount}
        onOpenApprovals={handleOpenApprovals}
      />

      <SessionTabs
        sessions={filteredSessions}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        onArchiveSession={archiveSession}
        workspaceName={activeWorkspace?.name}
      />

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {/* Terminal panes */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {!activeSessionId ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'var(--text-muted)',
              }}
            >
              Connecting...
            </div>
          ) : (
            <PaneContainer
              node={
                root.type === 'terminal' && root.sessionId === '' && activeSessionId
                  ? { ...root, sessionId: activeSessionId }
                  : root
              }
              activePaneId={activePaneId}
              onPaneFocus={setActivePaneId}
              onResize={resizePane}
              send={send}
              subscribe={subscribe}
            />
          )}
        </div>

        {/* Sidebar */}
        <Sidebar isOpen={sidebar.isOpen} width={sidebar.width} onResize={sidebar.setWidth}>
          <PanelAccordion
            id="git"
            title="Git"
            badge={
              git.status
                ? git.status.staged.length + git.status.unstaged.length + git.status.untracked.length
                : undefined
            }
            badgeColor={git.status && git.status.staged.length > 0 ? 'var(--green)' : undefined}
            isExpanded={sidebar.isPanelExpanded('git')}
            onToggle={sidebar.togglePanel}
          >
            <GitPanel status={git.status} commits={git.commits} onRefresh={git.requestRefresh} />
          </PanelAccordion>

          <PanelAccordion
            id="cost"
            title="Cost"
            badge={cost.summary ? `$${cost.summary.totalCostUsd.toFixed(2)}` : undefined}
            isExpanded={sidebar.isPanelExpanded('cost')}
            onToggle={sidebar.togglePanel}
          >
            <CostPanel summary={cost.summary} alerts={cost.alerts} />
          </PanelAccordion>

          <PanelAccordion
            id="claude"
            title="Claude"
            badge={claude.statuses.filter((s) => s.status === 'running').length || undefined}
            badgeColor="var(--green)"
            isExpanded={sidebar.isPanelExpanded('claude')}
            onToggle={sidebar.togglePanel}
          >
            <ClaudeStatusPanel
              statuses={claude.statuses}
              activeSessionId={activeSessionId}
              onStart={claude.startClaude}
              onStop={claude.stopClaude}
            />
          </PanelAccordion>

          <PanelAccordion
            id="tasks"
            title="Prompt Queue"
            badge={
              taskQueue.tasks.filter((t) => t.status === 'running').length > 0
                ? `▶${taskQueue.tasks.filter((t) => t.status === 'queued').length}`
                : taskQueue.tasks.filter((t) => t.status === 'queued').length || undefined
            }
            badgeColor={
              taskQueue.tasks.filter((t) => t.status === 'running').length > 0
                ? 'var(--green)'
                : 'var(--status-queued)'
            }
            isExpanded={sidebar.isPanelExpanded('tasks')}
            onToggle={sidebar.togglePanel}
          >
            <TaskPanel
              tasks={taskQueue.tasks}
              onCreate={taskQueue.createTask}
              onUpdate={taskQueue.updateTask}
              onDelete={taskQueue.deleteTask}
            />
          </PanelAccordion>

          <PanelAccordion
            id="approvals"
            title="Approvals"
            badge={approval.pendingCount || undefined}
            badgeColor="var(--risk-high)"
            isExpanded={sidebar.isPanelExpanded('approvals')}
            onToggle={sidebar.togglePanel}
          >
            <ApprovalPanel queue={approval.queue} onDecide={approval.decide} />
          </PanelAccordion>

          <PanelAccordion
            id="activity"
            title="Activity"
            isExpanded={sidebar.isPanelExpanded('activity', false)}
            onToggle={sidebar.togglePanel}
          >
            <ActivityPanel entries={activity.entries} digest={activity.digest} />
          </PanelAccordion>
        </Sidebar>
      </div>

      <StatusBarEnhanced
        connectionState={connectionState}
        activeSession={activeSession}
        gitStatus={git.status}
        totalCostUsd={cost.summary?.totalCostUsd ?? 0}
        claudeStatus={activeClaudeStatus}
        sidebarOpen={sidebar.isOpen}
        onToggleSidebar={sidebar.toggle}
      />

      {/* Overlays */}
      {overlay.activeOverlay === 'sessionList' && (
        <SessionListOverlay
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelect={setActiveSessionId}
          onArchive={archiveSession}
          onClose={overlay.closeOverlay}
        />
      )}

      {overlay.activeOverlay === 'workspaceList' && (
        <WorkspaceListOverlay
          workspaces={workspace.workspaces}
          activeWorkspaceId={workspace.activeWorkspaceId}
          onSelect={workspace.setActiveWorkspaceId}
          onCreate={workspace.createWorkspace}
          onDelete={workspace.deleteWorkspace}
          onRename={workspace.renameWorkspace}
          onClose={overlay.closeOverlay}
        />
      )}

      {overlay.activeOverlay === 'help' && (
        <HelpOverlay onClose={overlay.closeOverlay} />
      )}

      {overlay.activeOverlay === 'pairingQR' && (
        <PairingOverlay
          serverUrl={wsUrl.replace('ws:', 'http:').replace('wss:', 'https:')}
          tunnelUrl={tunnel.url}
          tunnelStatus={tunnel.status}
          onClose={overlay.closeOverlay}
        />
      )}

      {overlay.activeOverlay === 'commandPalette' && (
        <CommandPalette commands={commands} onClose={overlay.closeOverlay} />
      )}

      {/* Toast notifications */}
      <NotificationToast toasts={toasts} onDismiss={removeToast} />
    </>
  );
}
