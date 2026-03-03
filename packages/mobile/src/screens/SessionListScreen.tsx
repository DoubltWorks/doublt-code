/**
 * SessionListScreen — Shows all active sessions (cmux-style).
 *
 * Displays sessions in a list with:
 * - Session name and status
 * - Context usage bar
 * - Connected client count (shows if PC is also connected)
 * - Last activity time
 *
 * Tap a session to open it. Long press for options (handoff, kill, rename).
 */

import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import type { SessionListItem, SessionId } from '@doublt/shared';

interface Props {
  sessions: SessionListItem[];
  activeSessionId: SessionId | null;
  onSelectSession: (id: SessionId) => void;
  onHandoff: (id: SessionId) => void;
  connectionState: string;
}

function ContextBar({ usage }: { usage: number }) {
  const pct = Math.round(usage * 100);
  const color = usage >= 0.85 ? '#ef4444' : usage >= 0.6 ? '#f59e0b' : '#22c55e';

  return (
    <View style={styles.contextBarContainer}>
      <View style={styles.contextBarBg}>
        <View style={[styles.contextBarFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.contextBarText, { color }]}>{pct}%</Text>
    </View>
  );
}

function SessionItem({
  session,
  isActive,
  onPress,
  onLongPress,
}: {
  session: SessionListItem;
  isActive: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const statusColors: Record<string, string> = {
    active: '#22c55e',
    idle: '#6b7280',
    handoff_pending: '#f59e0b',
    archived: '#ef4444',
  };

  return (
    <TouchableOpacity
      style={[styles.sessionItem, isActive && styles.sessionItemActive]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <View style={styles.sessionHeader}>
        <View style={styles.sessionTitleRow}>
          <View style={[styles.statusDot, { backgroundColor: statusColors[session.status] ?? '#6b7280' }]} />
          <Text style={styles.sessionIndex}>{session.index}</Text>
          <Text style={styles.sessionName}>{session.name}</Text>
        </View>
        {session.clientCount > 1 && (
          <Text style={styles.clientBadge}>{session.clientCount} devices</Text>
        )}
      </View>
      <ContextBar usage={session.contextUsage} />
      <Text style={styles.sessionCwd}>{session.cwd}</Text>
      <Text style={styles.lastActivity}>
        {formatTimeAgo(session.lastActivityAt)}
      </Text>
    </TouchableOpacity>
  );
}

export function SessionListScreen({
  sessions,
  activeSessionId,
  onSelectSession,
  onHandoff,
  connectionState,
}: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Sessions</Text>
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

      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SessionItem
            session={item}
            isActive={item.id === activeSessionId}
            onPress={() => onSelectSession(item.id)}
            onLongPress={() => onHandoff(item.id)}
          />
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No active sessions. Start doublt on your PC first.
          </Text>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  title: { fontSize: 24, fontWeight: 'bold', color: '#f8fafc' },
  connectionStatus: { flexDirection: 'row', alignItems: 'center' },
  connectionDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  connectionText: { color: '#94a3b8', fontSize: 12 },
  list: { padding: 16 },
  sessionItem: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sessionItemActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#1e3a5f',
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sessionTitleRow: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  sessionIndex: { color: '#64748b', fontSize: 14, marginRight: 8, fontFamily: 'monospace' },
  sessionName: { color: '#f8fafc', fontSize: 16, fontWeight: '600' },
  clientBadge: {
    backgroundColor: '#3b82f6',
    color: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    fontSize: 11,
    overflow: 'hidden',
  },
  contextBarContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  contextBarBg: {
    flex: 1,
    height: 4,
    backgroundColor: '#334155',
    borderRadius: 2,
    marginRight: 8,
  },
  contextBarFill: { height: 4, borderRadius: 2 },
  contextBarText: { fontSize: 11, fontFamily: 'monospace', width: 35 },
  sessionCwd: { color: '#64748b', fontSize: 12, fontFamily: 'monospace', marginBottom: 4 },
  lastActivity: { color: '#475569', fontSize: 11 },
  emptyText: { color: '#64748b', textAlign: 'center', marginTop: 40, fontSize: 14 },
});
