import React, { useState, useEffect } from 'react';
import { Box, useApp, useStdout } from 'ink';
import type { ServerBridge } from '../bridge/ServerBridge.js';
import type { PaneManager } from '../cmux/PaneManager.js';
import type { DoubltServer } from '@doublt/server';
import type { ServerMessage } from '@doublt/shared';
import { useServerBridge } from './hooks/useServerBridge.js';
import { usePaneManager } from './hooks/usePaneManager.js';
import { useKeybindings, type Overlay } from './hooks/useKeybindings.js';
import { StatusBar } from './StatusBar.js';
import { PaneArea } from './PaneArea.js';
import { KeybindingBar } from './KeybindingBar.js';
import { SessionList } from './overlays/SessionList.js';
import { WorkspaceList } from './overlays/WorkspaceList.js';
import { ApprovalQueue } from './overlays/ApprovalQueue.js';
import { TaskList } from './overlays/TaskList.js';
import { Help } from './overlays/Help.js';
import { PairingQR } from './overlays/PairingQR.js';

interface Props {
  bridge: ServerBridge;
  paneManager: PaneManager;
  server: DoubltServer;
}

export function App({ bridge, paneManager, server }: Props) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [overlay, setOverlay] = useState<Overlay>('none');
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  const [tunnelUrl, setTunnelUrl] = useState<string | undefined>(undefined);

  const bridgeState = useServerBridge(bridge);
  const paneState = usePaneManager(paneManager);

  const termHeight = (stdout?.rows ?? 24) - 3; // status bar + keybinding bar + session info

  const { prefixMode } = useKeybindings({
    bridge,
    paneManager,
    server,
    currentWorkspaceId,
    onOverlayChange: setOverlay,
    onExit: () => {
      bridge.disconnect();
      exit();
    },
  });

  // Track workspace ID
  useEffect(() => {
    if (bridgeState.workspaces.length > 0 && !currentWorkspaceId) {
      setCurrentWorkspaceId(bridgeState.workspaces[0].id);
    }
  }, [bridgeState.workspaces, currentWorkspaceId]);

  // Auto-create pane on session creation
  useEffect(() => {
    const onSessionCreated = (msg: ServerMessage & { type: 'session:created' }) => {
      if (!paneManager.getPaneBySessionId(msg.session.id)) {
        const pane = paneManager.createPane(msg.session.id);
        pane.updateSessionInfo(msg.session);
        bridge.attachSession(msg.session.id);
      }
    };

    const onSessionList = (msg: ServerMessage & { type: 'session:list:result' }) => {
      for (const session of msg.sessions) {
        if (!paneManager.getPaneBySessionId(session.id)) {
          const pane = paneManager.createPane(session.id);
          pane.updateSessionInfo(session);
          bridge.attachSession(session.id);
        }
      }
    };

    const onHandoff = (msg: ServerMessage & { type: 'handoff:ready' }) => {
      if (!paneManager.getPaneBySessionId(msg.newSessionId)) {
        paneManager.createPane(msg.newSessionId);
        bridge.attachSession(msg.newSessionId);
      }
    };

    bridge.on('message:session:created', onSessionCreated);
    bridge.on('message:session:list:result', onSessionList);
    bridge.on('message:handoff:ready', onHandoff);

    return () => {
      bridge.off('message:session:created', onSessionCreated);
      bridge.off('message:session:list:result', onSessionList);
      bridge.off('message:handoff:ready', onHandoff);
    };
  }, [bridge, paneManager]);

  // Get pairing info
  const pairing = server.getPairingInfo();

  // Terminal lines for active pane
  const activeSessionId = paneState.activePane?.sessionId;
  const terminalLines = activeSessionId
    ? bridgeState.getTerminalLines(activeSessionId)
    : [];

  const closeOverlay = () => setOverlay('none');

  return (
    <Box flexDirection="column" width="100%" height="100%">
      <StatusBar
        panes={paneState.panes}
        activeIndex={paneState.activeIndex}
        connectionState={bridgeState.connectionState}
        tunnelUrl={tunnelUrl}
        prefixMode={prefixMode}
      />

      <PaneArea
        activePane={paneState.activePane}
        terminalLines={terminalLines}
        height={termHeight}
      />

      {overlay === 'sessionList' && (
        <SessionList
          panes={paneState.panes}
          activeIndex={paneState.activeIndex}
          onSelect={(idx) => paneManager.focusPane(idx)}
          onClose={closeOverlay}
        />
      )}

      {overlay === 'workspaceList' && (
        <WorkspaceList
          workspaces={bridgeState.workspaces}
          onSelect={(wsId) => {
            setCurrentWorkspaceId(wsId);
            bridge.listSessions(wsId);
          }}
          onClose={closeOverlay}
        />
      )}

      {overlay === 'approvalQueue' && (
        <ApprovalQueue
          items={[]}
          onDecide={(id, approved) => {
            if (activeSessionId) {
              bridge.approveTool(activeSessionId, id, approved);
            }
          }}
          onClose={closeOverlay}
        />
      )}

      {overlay === 'taskList' && (
        <TaskList
          tasks={[]}
          onClose={closeOverlay}
        />
      )}

      {overlay === 'help' && (
        <Help onClose={closeOverlay} />
      )}

      {overlay === 'pairingQR' && (
        <PairingQR
          pairingCode={pairing.code}
          pairingUrl={pairing.url}
          tunnelUrl={pairing.tunnelUrl}
          onClose={closeOverlay}
        />
      )}

      <KeybindingBar prefixMode={prefixMode} />
    </Box>
  );
}
