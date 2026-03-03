/**
 * doublt mobile app — Main entry point.
 *
 * Navigation flow:
 * 1. PairScreen: User pairs with PC (QR code or manual entry)
 * 2. SessionListScreen: Shows all sessions (cmux-style list)
 * 3. ChatScreen: Interact with a session (send messages, approve tools)
 *
 * The app maintains a persistent WebSocket connection to the doublt server.
 * Both mobile and PC can interact with sessions simultaneously.
 */

import React, { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useDoublt } from './hooks/useDoublt';
import { PairScreen } from './screens/PairScreen';
import { SessionListScreen } from './screens/SessionListScreen';
import { ChatScreen } from './screens/ChatScreen';

type Screen = 'pair' | 'sessions' | 'chat';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('pair');
  const [authError, setAuthError] = useState<string>();

  const doublt = useDoublt();

  // Auto-navigate on connection state changes
  React.useEffect(() => {
    if (doublt.connectionState === 'connected' && currentScreen === 'pair') {
      setCurrentScreen('sessions');
      setAuthError(undefined);
    }
    if (doublt.connectionState === 'disconnected' && currentScreen !== 'pair') {
      // Only go back to pair if we've fully lost connection
      // Don't navigate during reconnection attempts
    }
  }, [doublt.connectionState, currentScreen]);

  const handleConnect = (serverUrl: string, token: string) => {
    setAuthError(undefined);
    doublt.connect(serverUrl, token);
  };

  const handleSelectSession = (sessionId: string) => {
    doublt.selectSession(sessionId);
    setCurrentScreen('chat');
  };

  const handleHandoff = (sessionId?: string) => {
    if (sessionId) {
      doublt.selectSession(sessionId);
    }
    doublt.triggerHandoff();
  };

  const activeSession = doublt.sessions.find(s => s.id === doublt.activeSessionId) ?? null;

  switch (currentScreen) {
    case 'pair':
      return (
        <SafeAreaProvider>
          <PairScreen
            onConnect={handleConnect}
            connectionState={doublt.connectionState}
            error={authError}
          />
        </SafeAreaProvider>
      );

    case 'sessions':
      return (
        <SafeAreaProvider>
          <SessionListScreen
            sessions={doublt.sessions}
            activeSessionId={doublt.activeSessionId}
            onSelectSession={handleSelectSession}
            onHandoff={handleHandoff}
            connectionState={doublt.connectionState}
          />
        </SafeAreaProvider>
      );

    case 'chat':
      return (
        <SafeAreaProvider>
          <ChatScreen
            sessionInfo={activeSession}
            messages={doublt.activeMessages}
            pendingApprovals={doublt.pendingApprovals}
            onSendMessage={doublt.sendMessage}
            onApproveTool={doublt.approveTool}
            onHandoff={() => handleHandoff()}
            onBack={() => setCurrentScreen('sessions')}
          />
        </SafeAreaProvider>
      );
  }
}
