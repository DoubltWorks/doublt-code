/**
 * DigestScreen — Catch-up digest showing activity summary for a time period.
 *
 * Lets mobile users quickly understand what happened while they were away:
 * total messages, tool uses, errors, sessions active, commands run, and
 * a list of key highlighted events.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import type { DigestSummary, ActivityEventType, ActivityEvent } from '@doublt/shared/src/types/digest.js';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  digest: DigestSummary | null;
  onRequestDigest: (since: number) => void;
  onViewTimeline: () => void;
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

const PERIOD_OPTIONS = [
  { label: 'Last hour',    ms: 60 * 60 * 1000 },
  { label: 'Last 8 hours', ms: 8 * 60 * 60 * 1000 },
  { label: 'Last 24 hours', ms: 24 * 60 * 60 * 1000 },
] as const;

function KeyEventItem({ event }: { event: ActivityEvent }) {
  const color = EVENT_TYPE_COLORS[event.type] ?? '#94a3b8';
  const label = EVENT_TYPE_LABELS[event.type] ?? event.type.toUpperCase();

  return (
    <View style={styles.keyEventItem}>
      <View style={[styles.eventTypeDot, { backgroundColor: color }]} />
      <View style={styles.keyEventBody}>
        <View style={styles.keyEventHeader}>
          <View style={[styles.eventBadge, { backgroundColor: color }]}>
            <Text style={styles.eventBadgeText}>{label}</Text>
          </View>
          <Text style={styles.keyEventTime}>{formatTime(event.timestamp)}</Text>
        </View>
        <Text style={styles.keyEventSummary} numberOfLines={2}>
          {event.summary}
        </Text>
      </View>
    </View>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, accent ? { color: accent } : undefined]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function DigestScreen({ digest, onRequestDigest, onViewTimeline, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const [selectedPeriodIndex, setSelectedPeriodIndex] = useState(0);

  function handleSelectPeriod(index: number) {
    setSelectedPeriodIndex(index);
    const since = Date.now() - PERIOD_OPTIONS[index].ms;
    onRequestDigest(since);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#3b82f6" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Catch-up Digest</Text>
      </View>

      {/* Period selector */}
      <View style={styles.periodSelector}>
        {PERIOD_OPTIONS.map((opt, index) => (
          <TouchableOpacity
            key={opt.label}
            style={[
              styles.periodButton,
              selectedPeriodIndex === index && styles.periodButtonActive,
            ]}
            onPress={() => handleSelectPeriod(index)}
          >
            <Text
              style={[
                styles.periodButtonText,
                selectedPeriodIndex === index && styles.periodButtonTextActive,
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {digest === null ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#3b82f6" size="large" />
          <Text style={styles.loadingText}>Loading digest…</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Summary card */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryText}>{digest.summary}</Text>
          </View>

          {/* Stats grid */}
          <View style={styles.statsGrid}>
            <StatCard label="Messages"   value={digest.messagesCount} accent="#3b82f6" />
            <StatCard label="Tool Uses"  value={digest.toolUseCount}  accent="#8b5cf6" />
            <StatCard label="Errors"     value={digest.errorsCount}   accent={digest.errorsCount > 0 ? '#ef4444' : undefined} />
            <StatCard label="Sessions"   value={digest.sessionsActive} />
            <StatCard label="Commands"   value={digest.commandsRun}   accent="#22c55e" />
          </View>

          {/* Key events */}
          <Text style={styles.sectionTitle}>Key Events</Text>
          {digest.keyEvents.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptyText}>No notable events in this period.</Text>
            </View>
          ) : (
            <View style={styles.keyEventsList}>
              {digest.keyEvents.map(event => (
                <KeyEventItem key={event.id} event={event} />
              ))}
            </View>
          )}

          {/* View full timeline button */}
          <TouchableOpacity style={styles.timelineButton} onPress={onViewTimeline}>
            <Text style={styles.timelineButtonText}>View Full Timeline</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
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

  // Period selector
  periodSelector: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: '#3b82f6',
  },
  periodButtonText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  periodButtonTextActive: {
    color: '#f8fafc',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: { color: '#64748b', fontSize: 14 },

  // Scroll content
  scrollContent: { padding: 16, paddingBottom: 40 },

  // Summary card
  summaryCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  summaryText: { color: '#f8fafc', fontSize: 15, lineHeight: 22 },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    minWidth: 80,
    flex: 1,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statValue: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  statLabel: { color: '#64748b', fontSize: 11, marginTop: 4 },

  // Key events
  sectionTitle: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  keyEventsList: { gap: 8, marginBottom: 24 },
  keyEventItem: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'flex-start',
    gap: 10,
  },
  eventTypeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  keyEventBody: { flex: 1 },
  keyEventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
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
  keyEventTime: { color: '#64748b', fontSize: 11 },
  keyEventSummary: { color: '#cbd5e1', fontSize: 13, lineHeight: 18 },

  // Empty state
  emptySection: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  emptyText: { color: '#64748b', fontSize: 14 },

  // Timeline button
  timelineButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  timelineButtonText: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '600',
  },
});
