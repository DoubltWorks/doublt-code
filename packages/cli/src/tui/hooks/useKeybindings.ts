import { useState, useCallback } from 'react';
import { useInput } from 'ink';
import type { ServerBridge } from '../../bridge/ServerBridge.js';
import type { PaneManager } from '../../cmux/PaneManager.js';
import type { DoubltServer } from '@doublt/server';

export type Overlay =
  | 'none'
  | 'sessionList'
  | 'workspaceList'
  | 'approvalQueue'
  | 'taskList'
  | 'help'
  | 'pairingQR';

interface KeybindingsOptions {
  bridge: ServerBridge;
  paneManager: PaneManager;
  server: DoubltServer;
  currentWorkspaceId: string | null;
  onOverlayChange: (overlay: Overlay) => void;
  onExit: () => void;
}

export function useKeybindings({
  bridge,
  paneManager,
  server,
  currentWorkspaceId,
  onOverlayChange,
  onExit,
}: KeybindingsOptions) {
  const [prefixMode, setPrefixMode] = useState(false);

  const handlePrefixCommand = useCallback((input: string, key: { escape: boolean }) => {
    if (key.escape) return;

    switch (input) {
      case 'c':
        bridge.createSession(
          `session-${paneManager.paneCount}`,
          undefined,
          currentWorkspaceId ?? undefined,
        );
        break;
      case 'W':
        bridge.createWorkspace(`workspace-${Date.now()}`);
        break;
      case 'S':
        onOverlayChange('workspaceList');
        break;
      case 'n':
        paneManager.nextPane();
        break;
      case 'p':
        paneManager.previousPane();
        break;
      case 'w':
        onOverlayChange('sessionList');
        break;
      case 'm':
        onOverlayChange('pairingQR');
        break;
      case 'C': {
        const pane = paneManager.activePane;
        if (pane) {
          bridge.send({ type: 'claude:start', sessionId: pane.sessionId, autoRestart: true });
        }
        break;
      }
      case 'X': {
        const pane = paneManager.activePane;
        if (pane) {
          bridge.send({ type: 'claude:stop', sessionId: pane.sessionId });
        }
        break;
      }
      case 'h': {
        const pane = paneManager.activePane;
        if (pane) {
          bridge.triggerHandoff(pane.sessionId);
        }
        break;
      }
      case 'x': {
        const allPanes = paneManager.getAllPanes();
        const activePaneObj = paneManager.activePane;
        if (activePaneObj) {
          const idx = allPanes.indexOf(activePaneObj);
          bridge.detachSession(activePaneObj.sessionId);
          paneManager.removePane(idx);
        }
        break;
      }
      case 'a':
        onOverlayChange('approvalQueue');
        break;
      case 't':
        onOverlayChange('taskList');
        break;
      case 'd':
        bridge.disconnect();
        onExit();
        break;
      case '?':
        onOverlayChange('help');
        break;
      default:
        if (input >= '0' && input <= '9') {
          paneManager.focusPane(parseInt(input, 10));
        }
    }
  }, [bridge, paneManager, server, currentWorkspaceId, onOverlayChange, onExit]);

  useInput((input, key) => {
    if (input === 'c' && key.ctrl) {
      onExit();
      return;
    }

    if (input === 'b' && key.ctrl) {
      setPrefixMode(true);
      return;
    }

    if (prefixMode) {
      setPrefixMode(false);
      handlePrefixCommand(input, key);
      return;
    }

    // Normal mode: pass input to terminal
    const pane = paneManager.activePane;
    if (pane) {
      if (key.return) {
        bridge.sendTerminalInput(pane.sessionId, '\r');
      } else if (key.backspace) {
        bridge.sendTerminalInput(pane.sessionId, '\x7f');
      } else if (key.escape) {
        bridge.sendTerminalInput(pane.sessionId, '\x1b');
      } else if (key.tab) {
        bridge.sendTerminalInput(pane.sessionId, '\t');
      } else if (input) {
        bridge.sendTerminalInput(pane.sessionId, input);
      }
    }
  });

  return { prefixMode };
}
