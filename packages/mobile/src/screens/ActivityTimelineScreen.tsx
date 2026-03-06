/**
 * ActivityTimelineScreen — Chronological event timeline across sessions.
 *
 * Shows a vertical timeline of all activity events with optional filtering
 * by session. Supports infinite scroll via the "Load More" button.
 */

import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import type { TimelineEntry, ActivityEventType } from '@doublt/shared/src/types/digest.js';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  timeline: TimelineEntry[];
  onLoadMore: () => void;
  hasMore: boolean;
  sessionFilter?: string;
  onSetSessionFilter: (sessionId: string | undefined) => void;
  onBack: () => void;
}

const EVENT_TYPE_COLORS: Record<ActivityEventType, string> = {
  message:  '#3b82f6',
  tool_use: '#8b5cf6',
  error:    '#ef4444',
  handoff:  '#f59e0b',
  command:  '#22c55e',
  commit:   '#a78bfa',
};

const EVENT_TYPE_LABELS: Record<ActivityEventType, string> = {
  message:  'MSG',
  tool_use: 'TOOL',
  error:    'ERR',
  handoff:  'HANDOFF',
  command:  'CMD',
  commit:   'COMMIT',
};

function formatHHMM(timestamp: number): string {
  const d = new Date(timestamp);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function TimelineItem({
  entry,
  isLast,
}: {
  entry: TimelineEntry;
  isLast: boolean;
}) {
  const color = EVENT_TYPE_COLORS[entry.type] ?? '#94a3b8';
  const label = EVENT_TYPE_LABELS[entry.type] ?? entry.type.toUpperCase();

  return (
    <View style={styles.timelineRow}>
      {/* Left: time + connector */}
      <View style={styles.timeColumn}>
        <Text style={styles.timeLabel}>{formatHHMM(entry.timestamp)}</Text>
        <View style={styles.connectorWrapper}>
          {!isLast && <View style={styles.connectorLine} />}
        </View>
      </View>

      {/* Right: event card */}
      <View style={styles.eventCard}>
        <View style={styles.eventCardHeader}>
          <View style={[styles.eventDot, { backgroundColor: color }]} />
          <View style={[styles.eventBadge, { backgroundColor: color }]}>
            <Text style={styles.eventBadgeText}>{label}</Text>
          </View>
          <Text style={styles.sessionName} numberOfLines={1}>
            {entry.sessionId}
          </Text>
        </View>
        <Text style={styles.eventTitle}>{entry.title}</Text>
        <Text style={styles.eventDetail} numberOfLines={3}>
          {entry.detail}
        </Text>
      </View>
    </View>
  );
}

function SessionFilterBar({
  sessions,
  current,
  onSelect,
}: {
  sessions: string[];
  current: string | undefined;
  onSelect: (id: string | undefined) => void;
}) {
  return (
    <View style={styles.filterBar}>
      <TouchableOpacity
        style={[styles.filterChip, current === undefined && styles.filterChipActive]}
        onPress={() => onSelect(undefined)}
      >
        <Text style={[styles.filterChipText, current === undefined && styles.filterChipTextActive]}>
          All
        </Text>
      </TouchableOpacity>
      {sessions.map(id => (
        <TouchableOpacity
          key={id}
          style={[styles.filterChip, current === id && styles.filterChipActive]}
          onPress={() => onSelect(id)}
        >
          <Text
            style={[styles.filterChipText, current === id && styles.filterChipTextActive]}
            numberOfLines={1}
          >
            {id}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function ActivityTimelineScreen({
  timeline,
  onLoadMore,
  hasMore,
  sessionFilter,
  onSetSessionFilter,
  onBack,
}: Props) {
  const insets = useSafeAreaInsets();
  // Derive unique session IDs from the timeline for the filter bar
  const uniqueSessions = Array.from(new Set(timeline.map(e => e.sessionId)));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#3b82f6" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Activity Timeline</Text>
      </View>

      {/* Session filter */}
      {uniqueSessions.length > 1 && (
        <SessionFilterBar
          sessions={uniqueSessions}
          current={sessionFilter}
          onSelect={onSetSessionFilter}
        />
      )}

      {/* Timeline list */}
      <FlatList
        data={timeline}
        keyExtractor={(item, index) => `${item.sessionId}-${item.timestamp}-${index}`}
        renderItem={({ item, index }) => (
          <TimelineItem entry={item} isLast={index === timeline.length - 1} />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No activity to show.</Text>
          </View>
        }
        ListFooterComponent={
          hasMore ? (
            <TouchableOpacity style={styles.loadMoreButton} onPress={onLoadMore}>
              <Text style={styles.loadMoreText}>Load More</Text>
            </TouchableOpacity>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backButton: { padding: 8, marginRight: 8 },
  backText: { color: '#3b82f6', fontSize: 20 },
  headerTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '600' },

  // Filter bar
  filterBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    maxWidth: 120,
  },
  filterChipActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  filterChipText: { color: '#94a3b8', fontSize: 12, fontWeight: '500' },
  filterChipTextActive: { color: '#f8fafc' },

  // List
  listContent: { padding: 16, paddingBottom: 40 },

  // Timeline row
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },

  // Left column: time + connector line
  timeColumn: {
    width: 52,
    alignItems: 'flex-end',
    paddingRight: 12,
  },
  timeLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
    marginTop: 4,
  },
  connectorWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  connectorLine: {
    width: 2,
    flex: 1,
    minHeight: 24,
    backgroundColor: '#334155',
  },

  // Event card (right side)
  eventCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  eventCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  eventDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  eventBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  eventBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  sessionName: {
    flex: 1,
    color: '#64748b',
    fontSize: 11,
    marginLeft: 4,
  },
  eventTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  eventDetail: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyText: { color: '#64748b', fontSize: 14 },

  // Load more
  loadMoreButton: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 8,
  },
  loadMoreText: { color: '#3b82f6', fontSize: 15, fontWeight: '600' },
});
