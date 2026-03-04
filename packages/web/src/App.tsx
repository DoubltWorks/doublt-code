import { useMemo, useCallback } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { useSessionManager } from './hooks/useSessionManager';
import { usePaneLayout } from './hooks/usePaneLayout';
import { Toolbar } from './components/Toolbar';
import { SessionTabs } from './components/SessionTabs';
import { PaneContainer } from './components/PaneContainer';
import { StatusBar } from './components/StatusBar';

function getConnectionParams(): { wsUrl: string; token: string } {
  const hash = window.location.hash.slice(1);
  const params = new URLSearchParams(hash);
  const token = params.get('token') ?? '';

  // Determine WebSocket URL from current location
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;

  return { wsUrl, token };
}

export function App() {
  const { wsUrl, token } = useMemo(() => getConnectionParams(), []);
  const { send, connectionState, subscribe } = useWebSocket(wsUrl, token);

  const {
    sessions,
    activeSessionId,
    setActiveSessionId,
    createSession,
  } = useSessionManager(send, subscribe, connectionState);

  const {
    root,
    activePaneId,
    setActivePaneId,
    splitPane,
    resizePane,
  } = usePaneLayout(activeSessionId ?? '');

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId),
    [sessions, activeSessionId],
  );

  const handleNewSession = useCallback(() => {
    createSession();
  }, [createSession]);

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

  const handleSelectSession = useCallback(
    (id: string) => {
      setActiveSessionId(id);
    },
    [setActiveSessionId],
  );

  return (
    <>
      <Toolbar
        connectionState={connectionState}
        onNewSession={handleNewSession}
        onSplitH={handleSplitH}
        onSplitV={handleSplitV}
      />

      <SessionTabs
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
      />

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

      <StatusBar
        connectionState={connectionState}
        serverUrl={wsUrl}
        activeSession={activeSession}
      />
    </>
  );
}
