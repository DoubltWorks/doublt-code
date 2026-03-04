/**
 * NotificationService — Mobile push notification and in-app alert management.
 *
 * Handles three types of notifications:
 * 1. In-app banners — Shown when the app is in foreground
 * 2. Push notifications — Delivered when the app is in background
 * 3. Background event listeners — Keep WebSocket alive for real-time updates
 *
 * Mirrors cmux's notification system and Happy Coder's push alerts,
 * unified into a single notification pipeline for doublt-code.
 */

import { Platform, AppState, type AppStateStatus } from 'react-native';
import type { SessionNotification, LongRunningCommand } from '@doublt/shared';
import type { OfflineStore } from './OfflineStore.js';

/** In-app notification that's displayed as a banner */
export interface InAppNotification {
  id: string;
  title: string;
  body: string;
  type: SessionNotification['type'];
  priority: 'low' | 'normal' | 'high' | 'critical';
  timestamp: number;
  sessionId: string;
  /** Whether the user has seen this notification */
  read: boolean;
  /** Optional action data (e.g., navigate to session, approve tool) */
  actionData?: Record<string, unknown>;
}

type NotificationCallback = (notification: InAppNotification) => void;

export class NotificationService {
  private listeners: NotificationCallback[] = [];
  private notifications: InAppNotification[] = [];
  private unreadCount = 0;
  private appState: AppStateStatus = 'active';
  private pushToken: string | null = null;
  private offlineStore: OfflineStore | null = null;
  private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

  constructor(offlineStore?: OfflineStore) {
    this.offlineStore = offlineStore ?? null;

    // Track app state for deciding push vs in-app delivery
    this.appStateSubscription = AppState.addEventListener('change', (state) => {
      this.appState = state;
    });
  }

  /** Clean up subscriptions */
  destroy(): void {
    this.appStateSubscription?.remove();
    this.appStateSubscription = null;
  }

  /** Attach an OfflineStore for notification persistence */
  setOfflineStore(store: OfflineStore): void {
    this.offlineStore = store;
  }

  /** Load persisted notifications from OfflineStore (call on app startup) */
  async loadPersistedNotifications(): Promise<void> {
    if (!this.offlineStore) return;
    const cached = await this.offlineStore.loadNotifications();
    for (const serverNotif of cached) {
      // Restore as InAppNotification without re-emitting to listeners
      const inApp: InAppNotification = {
        id: `notif-restored-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: serverNotif.title,
        body: serverNotif.body,
        type: serverNotif.type,
        priority: serverNotif.priority,
        timestamp: serverNotif.timestamp,
        sessionId: serverNotif.sessionId,
        read: true, // Persisted notifications are considered read
        actionData: serverNotif.data,
      };
      this.notifications.push(inApp);
    }
    // Cap at 200
    if (this.notifications.length > 200) {
      this.notifications = this.notifications.slice(0, 200);
    }
  }

  /** Persist current notifications to OfflineStore */
  private persistNotifications(): void {
    if (!this.offlineStore) return;
    // Convert InAppNotifications back to SessionNotification shape for storage
    const toCache: SessionNotification[] = this.notifications.slice(0, 100).map(n => ({
      sessionId: n.sessionId,
      type: n.type,
      title: n.title,
      body: n.body,
      timestamp: n.timestamp,
      priority: n.priority,
      pushEnabled: false,
      data: n.actionData,
    }));
    void this.offlineStore.cacheNotifications(toCache);
  }

  /**
   * Register a listener for new notifications.
   */
  onNotification(callback: NotificationCallback): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  /**
   * Process an incoming SessionNotification from the server.
   * Creates an InAppNotification and delivers it appropriately.
   */
  handleServerNotification(notification: SessionNotification): InAppNotification {
    const inApp: InAppNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: notification.title,
      body: notification.body,
      type: notification.type,
      priority: notification.priority,
      timestamp: notification.timestamp,
      sessionId: notification.sessionId,
      read: false,
      actionData: notification.data,
    };

    this.notifications.unshift(inApp);
    this.unreadCount++;

    // Cap at 200 notifications
    if (this.notifications.length > 200) {
      this.notifications = this.notifications.slice(0, 200);
    }

    // Deliver to listeners (for in-app display)
    for (const listener of this.listeners) {
      listener(inApp);
    }

    // Persist notifications to offline store
    this.persistNotifications();

    // If app is in background and this is a high-priority notification,
    // schedule a local push notification
    if (this.appState !== 'active' && notification.pushEnabled) {
      this.scheduleLocalNotification(inApp);
    }

    return inApp;
  }

  /**
   * Handle tool approval needed — critical priority notification.
   */
  handleToolApproval(sessionId: string, toolName: string, toolUseId: string): InAppNotification {
    return this.handleServerNotification({
      sessionId,
      type: 'approval_needed',
      title: 'Tool Approval Required',
      body: `${toolName} needs your approval`,
      timestamp: Date.now(),
      priority: 'critical',
      pushEnabled: true,
      data: { toolName, toolUseId },
    });
  }

  /**
   * Handle long-running command completion notification.
   */
  handleCommandComplete(command: LongRunningCommand): InAppNotification {
    const isSuccess = command.status === 'completed';
    const elapsed = ((command.completedAt ?? Date.now()) - command.startedAt) / 1000;

    return this.handleServerNotification({
      sessionId: command.sessionId,
      type: isSuccess ? 'command_complete' : 'command_failed',
      title: isSuccess ? 'Command Completed' : 'Command Failed',
      body: `"${command.command}" ${isSuccess ? 'finished' : 'failed'} after ${elapsed.toFixed(1)}s`,
      timestamp: Date.now(),
      priority: isSuccess ? 'normal' : 'high',
      pushEnabled: true,
      data: {
        commandId: command.id,
        command: command.command,
        exitCode: command.exitCode,
      },
    });
  }

  /**
   * Mark a notification as read.
   */
  markRead(notificationId: string): void {
    const notif = this.notifications.find(n => n.id === notificationId);
    if (notif && !notif.read) {
      notif.read = true;
      this.unreadCount = Math.max(0, this.unreadCount - 1);
    }
  }

  /**
   * Mark all notifications as read.
   */
  markAllRead(): void {
    for (const notif of this.notifications) {
      notif.read = true;
    }
    this.unreadCount = 0;
  }

  /**
   * Get all notifications (most recent first).
   */
  getAll(): InAppNotification[] {
    return this.notifications;
  }

  /**
   * Get unread count.
   */
  getUnreadCount(): number {
    return this.unreadCount;
  }

  /**
   * Set push notification token (from expo-notifications).
   */
  setPushToken(token: string): void {
    this.pushToken = token;
  }

  getPushToken(): string | null {
    return this.pushToken;
  }

  /**
   * Schedule a local notification when app is in background.
   * Uses React Native's built-in notification API.
   */
  private scheduleLocalNotification(_notification: InAppNotification): void {
    // In a production app, this would use expo-notifications:
    // Notifications.scheduleNotificationAsync({
    //   content: {
    //     title: notification.title,
    //     body: notification.body,
    //     data: { sessionId: notification.sessionId, ...notification.actionData },
    //     sound: notification.priority === 'critical' ? 'default' : undefined,
    //     priority: notification.priority === 'critical'
    //       ? Notifications.AndroidNotificationPriority.MAX
    //       : Notifications.AndroidNotificationPriority.DEFAULT,
    //   },
    //   trigger: null, // immediate
    // });

    // Note: listeners are already notified in handleServerNotification()
    // — no re-emit here to avoid double notification delivery
  }

  /**
   * Clean up old notifications.
   */
  cleanup(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAgeMs;
    this.notifications = this.notifications.filter(n => n.timestamp > cutoff);
    this.unreadCount = this.notifications.filter(n => !n.read).length;
    this.persistNotifications();
  }
}
