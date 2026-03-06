/**
 * ApprovalQueueScreen — Mobile screen for reviewing and deciding on pending tool approvals.
 *
 * Shows each queued item with its risk level, tool name, input preview, and
 * approve/deny buttons. Matches the dark theme used across the mobile app.
 */

import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import type { ApprovalQueueItem } from '@doublt/shared/src/types/approval.js';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  approvalQueue: ApprovalQueueItem[];
  onDecide: (queueItemId: string, approved: boolean) => void;
  onApproveAll: () => void;
  onBack: () => void;
}

function timeAgo(ts: number): string {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

const RISK_COLOR: Record<ApprovalQueueItem['riskLevel'], string> = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#ef4444',
};

function ApprovalItem({
  item,
  onDecide,
}: {
  item: ApprovalQueueItem;
  onDecide: (queueItemId: string, approved: boolean) => void;
}) {
  const inputPreview = JSON.stringify(item.input).slice(0, 120);
  const truncated = JSON.stringify(item.input).length > 120;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.riskBadge, { backgroundColor: RISK_COLOR[item.riskLevel] }]}>
          <Text style={styles.riskText}>{item.riskLevel.toUpperCase()}</Text>
        </View>
        <Text style={styles.timeAgo}>{timeAgo(item.createdAt)}</Text>
      </View>
      <Text style={styles.toolName}>{item.toolName}</Text>
      <Text style={styles.inputPreview}>
        {inputPreview}
        {truncated ? '…' : ''}
      </Text>
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.denyButton}
          onPress={() => onDecide(item.id, false)}
        >
          <Text style={styles.denyButtonText}>Deny</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.approveButton}
          onPress={() => onDecide(item.id, true)}
        >
          <Text style={styles.approveButtonText}>Approve</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function ApprovalQueueScreen({ approvalQueue, onDecide, onApproveAll, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const pending = approvalQueue.filter(i => i.status === 'pending');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Approval Queue</Text>
        {pending.length > 0 && (
          <TouchableOpacity style={styles.approveAllButton} onPress={onApproveAll}>
            <Text style={styles.approveAllText}>Approve All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      {pending.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No pending approvals</Text>
        </View>
      ) : (
        <FlatList
          data={pending}
          keyExtractor={(item: ApprovalQueueItem) => item.id}
          renderItem={({ item }: { item: ApprovalQueueItem }) => <ApprovalItem item={item} onDecide={onDecide} />}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
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
  headerTitle: { flex: 1, color: '#f8fafc', fontSize: 18, fontWeight: '600' },
  approveAllButton: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  approveAllText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  listContent: { padding: 16 },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginRight: 8,
  },
  riskText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  timeAgo: { color: '#64748b', fontSize: 12, marginLeft: 'auto' },
  toolName: {
    color: '#f8fafc',
    fontSize: 15,
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  inputPreview: {
    color: '#94a3b8',
    fontSize: 12,
    fontFamily: 'monospace',
    backgroundColor: '#0f172a',
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
  },
  buttonRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  denyButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ef4444',
    marginRight: 8,
  },
  denyButtonText: { color: '#ef4444', fontWeight: '600' },
  approveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#22c55e',
  },
  approveButtonText: { color: '#fff', fontWeight: '600' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#64748b', fontSize: 16 },
});
