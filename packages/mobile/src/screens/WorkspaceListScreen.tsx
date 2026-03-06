/**
 * WorkspaceListScreen — Shows all doubltmux workspaces.
 *
 * This is the main navigation hub for the mobile app.
 * Users can:
 * - See all workspaces with their status and session count
 * - Tap a workspace to see its sessions
 * - Create new workspaces
 * - View unread notification count
 *
 * Navigation: PairScreen -> WorkspaceListScreen -> SessionListScreen -> ChatScreen
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import type { WorkspaceListItem, WorkspaceId } from '@doublt/shared';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  workspaces: WorkspaceListItem[];
  activeWorkspaceId: WorkspaceId | null;
  onSelectWorkspace: (id: WorkspaceId) => void;
  onCreateWorkspace: () => void;
  connectionState: string;
  unreadNotificationCount: number;
  onOpenNotifications: () => void;
  onOpenSearch?: () => void;
  onRefresh?: () => void;
}

function WorkspaceItem({
  workspace,
  isActive,
  onPress,
}: {
  workspace: WorkspaceListItem;
  isActive: boolean;
  onPress: () => void;
}) {
  const statusColors: Record<string, string> = {
    active: '#22c55e',
    idle: '#6b7280',
    archived: '#ef4444',
  };

  return (
    <TouchableOpacity
      style={[styles.workspaceItem, isActive && styles.workspaceItemActive]}
      onPress={onPress}
    >
      <View style={styles.workspaceHeader}>
        <View style={styles.workspaceTitleRow}>
          <View style={[styles.statusDot, { backgroundColor: statusColors[workspace.status] ?? '#6b7280' }]} />
          <Text style={styles.workspaceIndex}>{workspace.index}</Text>
          <Text style={styles.workspaceName}>{workspace.name}</Text>
        </View>
        <View style={styles.sessionCountBadge}>
          <Text style={styles.sessionCountText}>
            {workspace.activeSessionCount}/{workspace.sessionCount}
          </Text>
        </View>
      </View>
      <Text style={styles.workspaceCwd}>{workspace.cwd}</Text>
      <View style={styles.workspaceMeta}>
        <Text style={styles.sessionLabel}>
          {workspace.sessionCount === 1 ? '1 session' : `${workspace.sessionCount} sessions`}
        </Text>
        <Text style={styles.lastActivity}>
          {formatTimeAgo(workspace.lastActivityAt)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export function WorkspaceListScreen({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onCreateWorkspace,
  connectionState,
  unreadNotificationCount,
  onOpenNotifications,
  onOpenSearch,
  onRefresh,
}: Props) {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    onRefresh?.();
    setTimeout(() => setRefreshing(false), 1000);
  }, [onRefresh]);
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>doubltmux</Text>
          <Text style={styles.subtitle}>Workspaces</Text>
        </View>
        <View style={styles.headerRight}>
          {onOpenSearch && (
            <TouchableOpacity style={styles.notificationButton} onPress={onOpenSearch}>
              <Ionicons name="search" size={18} color="#94a3b8" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.notificationButton} onPress={onOpenNotifications}>
            <Ionicons name="notifications" size={18} color="#94a3b8" />
            {unreadNotificationCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.connectionStatus}>
            <View
              style={[
                styles.connectionDot,
                { backgroundColor: connectionState === 'connected' ? '#22c55e' : '#ef4444' },
              ]}
            />
            <Text style={styles.connectionText}>{connectionState}</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={workspaces}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <WorkspaceItem
            workspace={item}
            isActive={item.id === activeWorkspaceId}
            onPress={() => onSelectWorkspace(item.id)}
          />
        )}
        contentContainerStyle={styles.list}
        onRefresh={onRefresh ? handleRefresh : undefined}
        refreshing={refreshing}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No workspaces yet. Start doublt on your PC first.
          </Text>
        }
      />

      <TouchableOpacity style={styles.createButton} onPress={onCreateWorkspace}>
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={styles.createButtonText}>New Workspace</Text>
      </TouchableOpacity>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3b82f6',
    fontFamily: 'monospace',
  },
  subtitle: { fontSize: 14, color: '#94a3b8', marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  notificationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    padding: 4,
  },
  notificationIcon: { color: '#94a3b8', fontSize: 14 },
  notificationBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
    paddingHorizontal: 4,
  },
  notificationBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  connectionStatus: { flexDirection: 'row', alignItems: 'center' },
  connectionDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  connectionText: { color: '#94a3b8', fontSize: 12 },
  list: { padding: 16 },
  workspaceItem: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  workspaceItemActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#1e3a5f',
  },
  workspaceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  workspaceTitleRow: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  workspaceIndex: { color: '#64748b', fontSize: 14, marginRight: 8, fontFamily: 'monospace' },
  workspaceName: { color: '#f8fafc', fontSize: 16, fontWeight: '600' },
  sessionCountBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  sessionCountText: { color: '#94a3b8', fontSize: 12, fontFamily: 'monospace' },
  workspaceCwd: { color: '#64748b', fontSize: 12, fontFamily: 'monospace', marginBottom: 6 },
  workspaceMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionLabel: { color: '#94a3b8', fontSize: 12 },
  lastActivity: { color: '#475569', fontSize: 11 },
  emptyText: { color: '#64748b', textAlign: 'center', marginTop: 40, fontSize: 14 },
  createButton: {
    flexDirection: 'row',
    backgroundColor: '#3b82f6',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  createButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
