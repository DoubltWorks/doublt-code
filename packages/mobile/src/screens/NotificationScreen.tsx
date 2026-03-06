/**
 * NotificationScreen — Shows all notifications from doubltmux sessions.
 *
 * Displays:
 * - Tool approval requests (critical — needs immediate action)
 * - Long-running command completions
 * - Context usage warnings
 * - Handoff notifications
 * - Error alerts
 *
 * Unread notifications are highlighted. Tapping a notification
 * navigates to the relevant session.
 */

import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import type { InAppNotification } from '../services/NotificationService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  notifications: InAppNotification[];
  unreadCount: number;
  onSelectNotification: (notification: InAppNotification) => void;
  onMarkAllRead: () => void;
  onBack: () => void;
}

const TYPE_COLORS: Record<string, string> = {
  approval_needed: '#f59e0b',
  context_high: '#ef4444',
  handoff_ready: '#3b82f6',
  command_complete: '#22c55e',
  command_failed: '#ef4444',
  completed: '#22c55e',
  error: '#ef4444',
};

const TYPE_LABELS: Record<string, string> = {
  approval_needed: 'APPROVAL',
  context_high: 'CONTEXT',
  handoff_ready: 'HANDOFF',
  command_complete: 'DONE',
  command_failed: 'FAILED',
  completed: 'DONE',
  error: 'ERROR',
};

function NotificationItem({
  notification,
  onPress,
}: {
  notification: InAppNotification;
  onPress: () => void;
}) {
  const color = TYPE_COLORS[notification.type] ?? '#94a3b8';
  const label = TYPE_LABELS[notification.type] ?? notification.type;

  return (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        !notification.read && styles.notificationUnread,
        notification.priority === 'critical' && styles.notificationCritical,
      ]}
      onPress={onPress}
    >
      <View style={styles.notificationHeader}>
        <View style={[styles.typeBadge, { backgroundColor: color }]}>
          <Text style={styles.typeBadgeText}>{label}</Text>
        </View>
        <Text style={styles.notificationTime}>
          {formatTimeAgo(notification.timestamp)}
        </Text>
      </View>
      <Text style={styles.notificationTitle}>{notification.title}</Text>
      <Text style={styles.notificationBody}>{notification.body}</Text>
      {!notification.read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
}

export function NotificationScreen({
  notifications,
  unreadCount,
  onSelectNotification,
  onMarkAllRead,
  onBack,
}: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>{'<'}</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={styles.unreadLabel}>{unreadCount} unread</Text>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={onMarkAllRead} style={styles.markAllButton}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotificationItem
            notification={item}
            onPress={() => onSelectNotification(item)}
          />
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No notifications yet.</Text>
        }
      />
    </View>
  );
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backButton: { padding: 8, marginRight: 8 },
  backText: { color: '#3b82f6', fontSize: 20 },
  headerInfo: { flex: 1 },
  headerTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '600' },
  unreadLabel: { color: '#f59e0b', fontSize: 12, marginTop: 2 },
  markAllButton: { padding: 8 },
  markAllText: { color: '#3b82f6', fontSize: 13 },
  list: { padding: 16 },
  notificationItem: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
    position: 'relative',
  },
  notificationUnread: {
    borderColor: '#3b82f6',
    backgroundColor: '#1e2d4a',
  },
  notificationCritical: {
    borderColor: '#f59e0b',
    backgroundColor: '#2a2012',
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  notificationTime: { color: '#64748b', fontSize: 11 },
  notificationTitle: { color: '#f8fafc', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  notificationBody: { color: '#94a3b8', fontSize: 13, lineHeight: 18 },
  unreadDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3b82f6',
  },
  emptyText: { color: '#64748b', textAlign: 'center', marginTop: 40, fontSize: 14 },
});
