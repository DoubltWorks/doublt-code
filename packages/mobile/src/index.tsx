/**
 * doublt mobile app — Main entry point.
 *
 * Navigation flow:
 * 1. PairScreen: User pairs with PC (QR code or manual entry)
 * 2. WorkspaceListScreen: Shows all workspaces (doubltmux groups)
 * 3. SessionListScreen: Shows sessions in selected workspace
 * 4. ChatScreen: Interact with a session (send messages, approve tools)
 * 5. TerminalScreen: View terminal output synced from PC
 * 6. NotificationScreen: View all notifications
 *
 * The app maintains a persistent WebSocket connection to the doublt server.
 * Both mobile and PC can interact with sessions simultaneously.
 * Background task service keeps connection alive for push notifications.
 */

import React, { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useDoublt } from './hooks/useDoublt';
import { PairScreen } from './screens/PairScreen';
import { WorkspaceListScreen } from './screens/WorkspaceListScreen';
import { SessionListScreen } from './screens/SessionListScreen';
import { ChatScreen } from './screens/ChatScreen';
import { TerminalScreen } from './screens/TerminalScreen';
import { NotificationScreen } from './screens/NotificationScreen';

type Screen = 'pair' | 'workspaces' | 'sessions' | 'chat' | 'terminal' | 'notifications';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('pair');
  const [authError, setAuthError] = useState<string>();

  const doublt = useDoublt();

  // Auto-navigate on connection state changes
  React.useEffect(() => {
    if (doublt.connectionState === 'connected' && currentScreen === 'pair') {
      setCurrentScreen('workspaces');
      setAuthError(undefined);
    }
  }, [doublt.connectionState, currentScreen]);

  const handleConnect = (serverUrl: string, token: string) => {
    setAuthError(undefined);
    doublt.connect(serverUrl, token);
  };

  const handleSelectWorkspace = (workspaceId: string) => {
    doublt.selectWorkspace(workspaceId);
    setCurrentScreen('sessions');
  };

  const handleSelectSession = (sessionId: string) => {
    doublt.selectSession(sessionId);
    setCurrentScreen('chat');
  };

  const handleOpenTerminal = (sessionId: string) => {
    doublt.selectSession(sessionId);
    setCurrentScreen('terminal');
  };

  const handleHandoff = (sessionId?: string) => {
    if (sessionId) {
      doublt.selectSession(sessionId);
    }
    doublt.triggerHandoff();
  };

  const handleNotificationSelect = (notification: { id: string; sessionId: string }) => {
    doublt.markNotificationRead(notification.id);
    doublt.selectSession(notification.sessionId);
    setCurrentScreen('chat');
  };

  const activeSession = doublt.sessions.find(s => s.id === doublt.activeSessionId) ?? null;
  const activeWorkspace = doublt.workspaces.find(ws => ws.id === doublt.activeWorkspaceId) ?? null;

  const renderScreen = () => {
    switch (currentScreen) {
      case 'pair':
        return (
          <PairScreen
            onConnect={handleConnect}
            connectionState={doublt.connectionState}
            error={authError}
          />
        );

      case 'workspaces':
        return (
          <WorkspaceListScreen
            workspaces={doublt.workspaces}
            activeWorkspaceId={doublt.activeWorkspaceId}
            onSelectWorkspace={handleSelectWorkspace}
            onCreateWorkspace={() => doublt.createWorkspace()}
            connectionState={doublt.connectionState}
            unreadNotificationCount={doublt.unreadNotificationCount}
            onOpenNotifications={() => setCurrentScreen('notifications')}
          />
        );

      case 'sessions':
        return (
          <SessionListScreen
            sessions={doublt.workspaceSessions}
            activeSessionId={doublt.activeSessionId}
            activeWorkspace={activeWorkspace}
            onSelectSession={handleSelectSession}
            onOpenTerminal={handleOpenTerminal}
            onHandoff={handleHandoff}
            onCreateSession={() => doublt.createSession()}
            onBack={() => setCurrentScreen('workspaces')}
            connectionState={doublt.connectionState}
          />
        );

      case 'chat':
        return (
          <ChatScreen
            sessionInfo={activeSession}
            messages={doublt.activeMessages}
            pendingApprovals={doublt.pendingApprovals}
            onSendMessage={doublt.sendMessage}
            onApproveTool={doublt.approveTool}
            onHandoff={() => handleHandoff()}
            onBack={() => setCurrentScreen('sessions')}
          />
        );

      case 'terminal':
        return (
          <TerminalScreen
            sessionInfo={activeSession}
            terminalOutput={doublt.activeTerminalOutput}
            runningCommands={doublt.runningCommands}
            onSendInput={doublt.sendTerminalInput}
            onBack={() => setCurrentScreen('sessions')}
          />
        );

      case 'notifications':
        return (
          <NotificationScreen
            notifications={doublt.notifications}
            unreadCount={doublt.unreadNotificationCount}
            onSelectNotification={handleNotificationSelect}
            onMarkAllRead={doublt.markAllNotificationsRead}
            onBack={() => setCurrentScreen('workspaces')}
          />
        );
    }
  };

  return (
    <SafeAreaProvider>
      {renderScreen()}
    </SafeAreaProvider>
  );
}
