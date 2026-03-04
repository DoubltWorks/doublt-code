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
 * 7. ApprovalQueueScreen: Approve/deny pending tool uses
 * 8. ApprovalPolicyScreen: Manage approval policies
 * 9. TaskQueueScreen: Manage task queue
 * 10. DigestScreen: Catch-up digest
 * 11. ActivityTimelineScreen: Activity timeline
 * 12. GitStatusScreen: Git status viewer
 * 13. UsageDashboardScreen: Cost & usage dashboard
 * 14. SearchScreen: Search across sessions
 * 15. TemplateScreen: Session templates
 * 16. MacroScreen: Command macros
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
import { ApprovalQueueScreen } from './screens/ApprovalQueueScreen';
import { ApprovalPolicyScreen } from './screens/ApprovalPolicyScreen';
import { TaskQueueScreen } from './screens/TaskQueueScreen';
import { DigestScreen } from './screens/DigestScreen';
import { ActivityTimelineScreen } from './screens/ActivityTimelineScreen';
import { GitStatusScreen } from './screens/GitStatusScreen';
import { UsageDashboardScreen } from './screens/UsageDashboardScreen';
import { SearchScreen } from './screens/SearchScreen';
import { TemplateScreen } from './screens/TemplateScreen';
import { MacroScreen } from './screens/MacroScreen';

type Screen =
  | 'pair'
  | 'workspaces'
  | 'sessions'
  | 'chat'
  | 'terminal'
  | 'notifications'
  | 'approvalQueue'
  | 'approvalPolicy'
  | 'taskQueue'
  | 'digest'
  | 'timeline'
  | 'gitStatus'
  | 'usageDashboard'
  | 'search'
  | 'templates'
  | 'macros';

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

  const handleSearchSelect = (result: { type: string; id: string; sessionId?: string }) => {
    if (result.sessionId) {
      doublt.selectSession(result.sessionId);
      setCurrentScreen('chat');
    }
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
            onOpenSearch={() => setCurrentScreen('search')}
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
            gitStatus={doublt.gitStatus}
            onOpenGitStatus={(sessionId) => {
              doublt.selectSession(sessionId);
              doublt.requestGitStatus(sessionId);
              doublt.requestGitLog(sessionId);
              setCurrentScreen('gitStatus');
            }}
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
            costUsd={doublt.activeSessionCost}
            macros={doublt.macros}
            onOpenApprovals={() => {
              doublt.listApprovalQueue();
              setCurrentScreen('approvalQueue');
            }}
            onOpenTasks={() => setCurrentScreen('taskQueue')}
            onOpenDigest={() => setCurrentScreen('digest')}
            onOpenUsage={() => {
              doublt.requestUsage();
              setCurrentScreen('usageDashboard');
            }}
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

      case 'approvalQueue':
        return (
          <ApprovalQueueScreen
            approvalQueue={doublt.approvalQueue}
            onDecide={doublt.decideApproval}
            onApproveAll={() => doublt.decideAllApprovals(true)}
            onBack={() => setCurrentScreen('chat')}
          />
        );

      case 'approvalPolicy':
        return (
          <ApprovalPolicyScreen
            policies={doublt.policies}
            activePolicyId={doublt.activePolicy?.id ?? null}
            onSetActive={() => {}}
            onApplyPreset={doublt.setApprovalPreset}
            onBack={() => setCurrentScreen('approvalQueue')}
          />
        );

      case 'taskQueue':
        return (
          <TaskQueueScreen
            tasks={doublt.tasks}
            onCreateTask={doublt.createTask}
            onCancelTask={doublt.cancelTask}
            onMoveUp={(taskId) => {
              const idx = doublt.tasks.findIndex(t => t.id === taskId);
              if (idx > 0) {
                const ids = doublt.tasks.map(t => t.id);
                [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
                doublt.reorderTasks(ids);
              }
            }}
            onMoveDown={(taskId) => {
              const idx = doublt.tasks.findIndex(t => t.id === taskId);
              if (idx < doublt.tasks.length - 1) {
                const ids = doublt.tasks.map(t => t.id);
                [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
                doublt.reorderTasks(ids);
              }
            }}
            onBack={() => setCurrentScreen('chat')}
          />
        );

      case 'digest':
        return (
          <DigestScreen
            digest={doublt.digest}
            onRequestDigest={doublt.requestDigest}
            onViewTimeline={() => {
              doublt.requestTimeline();
              setCurrentScreen('timeline');
            }}
            onBack={() => setCurrentScreen('chat')}
          />
        );

      case 'timeline':
        return (
          <ActivityTimelineScreen
            timeline={doublt.timeline}
            onLoadMore={() => doublt.requestTimeline()}
            hasMore={false}
            onSetSessionFilter={(sessionId) => doublt.requestTimeline(sessionId)}
            onBack={() => setCurrentScreen('digest')}
          />
        );

      case 'gitStatus':
        return (
          <GitStatusScreen
            gitStatus={doublt.activeGitStatus}
            gitLog={doublt.gitLog}
            onRefresh={() => doublt.requestGitStatus()}
            onViewDiff={() => {}}
            onBack={() => setCurrentScreen('sessions')}
          />
        );

      case 'usageDashboard':
        return (
          <UsageDashboardScreen
            usageSummary={doublt.usageSummary}
            budgetConfig={doublt.budgetConfig}
            onSetBudget={doublt.setBudget}
            onRefresh={() => doublt.requestUsage()}
            onBack={() => setCurrentScreen('chat')}
          />
        );

      case 'search':
        return (
          <SearchScreen
            searchResults={doublt.searchResults}
            onSearch={doublt.searchQuery}
            onSelectResult={handleSearchSelect}
            onBack={() => setCurrentScreen('workspaces')}
          />
        );

      case 'templates':
        return (
          <TemplateScreen
            templates={doublt.templates}
            onUseTemplate={doublt.useTemplate}
            onCreateTemplate={doublt.createTemplate}
            onDeleteTemplate={() => {}}
            onBack={() => setCurrentScreen('search')}
          />
        );

      case 'macros':
        return (
          <MacroScreen
            macros={doublt.macros}
            onSaveMacro={doublt.saveMacro}
            onDeleteMacro={doublt.deleteMacro}
            onBack={() => setCurrentScreen('chat')}
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
