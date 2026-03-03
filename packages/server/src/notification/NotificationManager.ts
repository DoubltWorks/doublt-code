/**
 * NotificationManager — Handles push notifications and in-app alerts.
 *
 * Manages notification delivery to mobile clients, including:
 * - In-app notifications via WebSocket
 * - Push notification token registration
 * - Notification queueing for offline clients
 * - Priority-based delivery (critical = always push, low = in-app only)
 *
 * Like cmux's notification system and Happy Coder's push alerts,
 * but unified into a single notification pipeline.
 */

import { EventEmitter } from 'node:events';
import type {
  SessionId,
  ClientId,
  SessionNotification,
  LongRunningCommand,
} from '@doublt/shared';

/** Expo Push API endpoint */
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/** Max push retry attempts */
const MAX_PUSH_RETRIES = 3;

interface PushRegistration {
  clientId: ClientId;
  pushToken: string;
  platform: 'ios' | 'android';
  registeredAt: number;
}

interface QueuedNotification {
  notification: SessionNotification;
  targetClientIds: ClientId[];
  createdAt: number;
}

export class NotificationManager extends EventEmitter {
  /** Push notification registrations by client ID */
  private pushRegistrations = new Map<ClientId, PushRegistration>();

  /** Pending notifications for offline clients (max 100 per client) */
  private pendingNotifications = new Map<ClientId, QueuedNotification[]>();

  /** Connected client IDs (updated externally) */
  private connectedClients = new Set<ClientId>();

  registerPushToken(clientId: ClientId, pushToken: string, platform: 'ios' | 'android'): void {
    this.pushRegistrations.set(clientId, {
      clientId,
      pushToken,
      platform,
      registeredAt: Date.now(),
    });
  }

  unregisterPushToken(clientId: ClientId): void {
    this.pushRegistrations.delete(clientId);
  }

  setClientConnected(clientId: ClientId, connected: boolean): void {
    if (connected) {
      this.connectedClients.add(clientId);
      // Flush pending notifications
      this.flushPending(clientId);
    } else {
      this.connectedClients.delete(clientId);
    }
  }

  /**
   * Send a notification to all clients attached to a session.
   * In-app notifications go via WebSocket; push notifications
   * are queued for delivery to registered mobile clients.
   */
  notify(notification: SessionNotification): void {
    // Emit for WebSocket delivery (ConnectionManager handles broadcasting)
    this.emit('notification:send', notification);

    // Queue push notification for offline mobile clients
    if (notification.pushEnabled) {
      this.queuePushNotification(notification);
    }
  }

  /**
   * Create and send a tool approval notification.
   */
  notifyApprovalNeeded(sessionId: SessionId, toolName: string, toolInput: Record<string, unknown>): void {
    this.notify({
      sessionId,
      type: 'approval_needed',
      title: 'Tool Approval Required',
      body: `${toolName} needs your approval`,
      timestamp: Date.now(),
      priority: 'critical',
      pushEnabled: true,
      data: { toolName, toolInput },
    });
  }

  /**
   * Create and send a command completion notification.
   */
  notifyCommandComplete(command: LongRunningCommand): void {
    const isSuccess = command.status === 'completed';
    const elapsed = ((command.completedAt ?? Date.now()) - command.startedAt) / 1000;

    this.notify({
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
        elapsed,
      },
    });
  }

  /**
   * Create and send a context usage warning notification.
   */
  notifyContextHigh(sessionId: SessionId, usage: number): void {
    this.notify({
      sessionId,
      type: 'context_high',
      title: 'Context Usage High',
      body: `Session context at ${Math.round(usage * 100)}% — handoff recommended`,
      timestamp: Date.now(),
      priority: 'high',
      pushEnabled: true,
      data: { usage },
    });
  }

  /**
   * Create and send a handoff ready notification.
   */
  notifyHandoffReady(sessionId: SessionId, newSessionId: SessionId): void {
    this.notify({
      sessionId,
      type: 'handoff_ready',
      title: 'Session Handoff Ready',
      body: 'A new session has been created from handoff',
      timestamp: Date.now(),
      priority: 'normal',
      pushEnabled: true,
      data: { newSessionId },
    });
  }

  private queuePushNotification(notification: SessionNotification): void {
    // For each registered push client, check if they're offline
    for (const [clientId, registration] of this.pushRegistrations) {
      if (!this.connectedClients.has(clientId)) {
        const queue = this.pendingNotifications.get(clientId) ?? [];
        queue.push({
          notification,
          targetClientIds: [clientId],
          createdAt: Date.now(),
        });
        // Cap at 100 pending notifications per client
        if (queue.length > 100) {
          queue.splice(0, queue.length - 100);
        }
        this.pendingNotifications.set(clientId, queue);

        // Emit push event for external push service integration
        this.emit('push:send', {
          registration,
          notification,
        });

        // Actually deliver via Expo Push API
        this.sendPushNotification(registration, notification).catch(() => {});
      }
    }
  }

  private flushPending(clientId: ClientId): void {
    const pending = this.pendingNotifications.get(clientId);
    if (!pending || pending.length === 0) return;

    for (const item of pending) {
      this.emit('notification:send', item.notification);
    }
    this.pendingNotifications.delete(clientId);
  }

  /**
   * Send an actual push notification via Expo Push API.
   * Uses native fetch (Node 18+). Retries up to MAX_PUSH_RETRIES.
   */
  private async sendPushNotification(
    registration: PushRegistration,
    notification: SessionNotification,
    attempt = 1,
  ): Promise<void> {
    const priorityMap: Record<string, 'default' | 'normal' | 'high'> = {
      low: 'normal',
      normal: 'default',
      high: 'high',
      critical: 'high',
    };

    const body = JSON.stringify({
      to: registration.pushToken,
      title: notification.title,
      body: notification.body,
      priority: priorityMap[notification.priority] ?? 'default',
      sound: notification.priority === 'critical' ? 'default' : null,
      badge: this.getUnreadCount(registration.clientId),
      data: {
        sessionId: notification.sessionId,
        type: notification.type,
        ...(notification.data ?? {}),
      },
    });

    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body,
      });

      if (!response.ok) {
        throw new Error(`Expo Push API returned ${response.status}`);
      }

      const result = await response.json() as { data?: Array<{ status: string; message?: string }> };
      const ticket = result.data?.[0];

      if (ticket?.status === 'error') {
        // Token might be invalid — clean up
        if (ticket.message?.includes('DeviceNotRegistered')) {
          this.pushRegistrations.delete(registration.clientId);
          this.emit('push:token_expired', { clientId: registration.clientId });
        }
        throw new Error(ticket.message ?? 'Push failed');
      }

      this.emit('push:delivered', {
        clientId: registration.clientId,
        notificationType: notification.type,
      });
    } catch (err) {
      if (attempt < MAX_PUSH_RETRIES) {
        const delay = 1000 * Math.pow(2, attempt - 1);
        setTimeout(() => {
          this.sendPushNotification(registration, notification, attempt + 1).catch(() => {});
        }, delay);
      } else {
        this.emit('push:failed', {
          clientId: registration.clientId,
          error: (err as Error).message,
          attempts: attempt,
        });
      }
    }
  }

  /**
   * Get unread notification count for a client (for badge number).
   */
  getUnreadCount(clientId: ClientId): number {
    const pending = this.pendingNotifications.get(clientId);
    return pending?.length ?? 0;
  }

  /**
   * Get all registered push tokens (for admin/debug).
   */
  getRegistrations(): PushRegistration[] {
    return Array.from(this.pushRegistrations.values());
  }

  /**
   * Clean up stale registrations.
   */
  cleanup(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    for (const [clientId, reg] of this.pushRegistrations) {
      if (now - reg.registeredAt > maxAgeMs) {
        this.pushRegistrations.delete(clientId);
      }
    }
    // Clean old pending notifications
    for (const [clientId, queue] of this.pendingNotifications) {
      const filtered = queue.filter(q => now - q.createdAt < maxAgeMs);
      if (filtered.length === 0) {
        this.pendingNotifications.delete(clientId);
      } else {
        this.pendingNotifications.set(clientId, filtered);
      }
    }
  }
}
