/**
 * BackgroundTaskService — Keeps doublt-code connected in the background.
 *
 * Ensures that:
 * 1. WebSocket connection persists when app is backgrounded
 * 2. Long-running command events are received and produce notifications
 * 3. Tool approval requests trigger push notifications even when app is closed
 *
 * Uses React Native's AppState and background task APIs to maintain
 * connectivity. Combined with NotificationService for alert delivery.
 */

import { AppState, type AppStateStatus } from 'react-native';
import type { DoubltClient } from './DoubltClient';
import { NotificationService } from './NotificationService';
import type { SessionNotification, LongRunningCommand, TerminalOutput } from '@doublt/shared';

export interface BackgroundTaskConfig {
  /** Keep WebSocket alive in background (default: true) */
  keepAlive: boolean;
  /** Notify on long-running command completion (default: true) */
  notifyOnCommandComplete: boolean;
  /** Notify on tool approval needed (default: true) */
  notifyOnApprovalNeeded: boolean;
  /** Minimum command duration (ms) to trigger notification (default: 10000) */
  longRunningThreshold: number;
}

const DEFAULT_CONFIG: BackgroundTaskConfig = {
  keepAlive: true,
  notifyOnCommandComplete: true,
  notifyOnApprovalNeeded: true,
  longRunningThreshold: 10_000,
};

export class BackgroundTaskService {
  private config: BackgroundTaskConfig;
  private appState: AppStateStatus = 'active';
  private keepAliveInterval: ReturnType<typeof setInterval> | null = null;
  private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
  private trackedCommands = new Map<string, LongRunningCommand>();

  constructor(
    private client: DoubltClient,
    private notificationService: NotificationService,
    config: Partial<BackgroundTaskConfig> = {},
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupListeners();
  }

  private setupListeners(): void {
    // Track app state transitions
    this.appStateSubscription = AppState.addEventListener('change', (nextState) => {
      const previousState = this.appState;
      this.appState = nextState;

      if (previousState === 'active' && nextState.match(/inactive|background/)) {
        this.onBackgrounded();
      } else if (previousState.match(/inactive|background/) && nextState === 'active') {
        this.onForegrounded();
      }
    });

    // Listen for server notifications
    this.client.on('notification', (notification: SessionNotification) => {
      this.notificationService.handleServerNotification(notification);
    });

    // Listen for command status updates
    this.client.on('commandStatus', (command: LongRunningCommand) => {
      this.handleCommandStatus(command);
    });

    // Listen for tool approval requests
    this.client.on('toolUse', (tool: { id: string; sessionId: string; toolName: string; status: string }) => {
      if (tool.status === 'pending' && this.config.notifyOnApprovalNeeded) {
        this.notificationService.handleToolApproval(tool.sessionId, tool.toolName, tool.id);
      }
    });

    // Listen for terminal output (accumulate for background)
    this.client.on('terminalOutput', (_output: TerminalOutput) => {
      // Terminal output is handled by the UI when foregrounded
      // In background, we just keep the connection alive
    });
  }

  private handleCommandStatus(command: LongRunningCommand): void {
    if (command.status === 'running') {
      this.trackedCommands.set(command.id, command);
    } else if (command.status === 'completed' || command.status === 'failed') {
      const tracked = this.trackedCommands.get(command.id);
      this.trackedCommands.delete(command.id);

      // Notify if the command was long-running
      if (this.config.notifyOnCommandComplete) {
        const elapsed = (command.completedAt ?? Date.now()) - command.startedAt;
        if (elapsed >= this.config.longRunningThreshold) {
          this.notificationService.handleCommandComplete(command);
        }
      }
    }
  }

  /**
   * Called when the app moves to background.
   * Keeps WebSocket alive for event listening.
   */
  private onBackgrounded(): void {
    if (!this.config.keepAlive) return;

    // Periodic check to keep the JS event loop alive so the OS
    // doesn't suspend the WebSocket connection while backgrounded.
    this.keepAliveInterval = setInterval(() => {
      // Keeping the interval running is sufficient to prevent suspension.
      // The client's built-in reconnect logic handles actual reconnection.
    }, 15_000);
  }

  /**
   * Called when the app returns to foreground.
   */
  private onForegrounded(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }

    // Refresh all data when coming back to foreground
    if (this.client.isConnected) {
      this.client.listSessions();
      this.client.listWorkspaces();
      this.client.listTasks();
      this.client.listApprovalQueue();
      this.client.requestUsage();
    }
  }

  /**
   * Get currently tracked long-running commands.
   */
  getTrackedCommands(): LongRunningCommand[] {
    return Array.from(this.trackedCommands.values());
  }

  /**
   * Update configuration.
   */
  updateConfig(config: Partial<BackgroundTaskConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Clean up all listeners and intervals.
   */
  destroy(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    this.trackedCommands.clear();
  }
}
