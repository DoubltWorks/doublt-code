/**
 * TaskQueueScreen — Shows and manages the task queue.
 *
 * Displays tasks with priority indicators, status badges, reorder controls,
 * and a form to add new tasks.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from 'react-native';
import type { Task, TaskPriority, TaskStatus } from '@doublt/shared/src/types/taskqueue.js';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  tasks: Task[];
  onCreateTask: (title: string, description: string, priority: TaskPriority) => void;
  onCancelTask: (taskId: string) => void;
  onMoveUp: (taskId: string) => void;
  onMoveDown: (taskId: string) => void;
  onBack: () => void;
}

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  critical: '#ef4444',
  high: '#f59e0b',
  normal: '#3b82f6',
  low: '#6b7280',
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  queued: '#6b7280',
  running: '#3b82f6',
  completed: '#22c55e',
  failed: '#ef4444',
  cancelled: '#6b7280',
};

const PRIORITIES: TaskPriority[] = ['critical', 'high', 'normal', 'low'];

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function TaskItem({
  task,
  onCancel,
  onMoveUp,
  onMoveDown,
}: {
  task: Task;
  onCancel: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const priorityColor = PRIORITY_COLORS[task.priority];
  const statusColor = STATUS_COLORS[task.status];
  const isQueued = task.status === 'queued';
  const isRunning = task.status === 'running';
  const canCancel = isQueued || isRunning;

  return (
    <View style={styles.taskItem}>
      <View style={[styles.priorityBar, { backgroundColor: priorityColor }]} />
      <View style={styles.taskContent}>
        <View style={styles.taskHeader}>
          <Text style={styles.taskTitle} numberOfLines={1}>
            {task.title}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '33', borderColor: statusColor }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{task.status}</Text>
          </View>
        </View>
        <Text style={styles.taskDescription} numberOfLines={2}>
          {task.description}
        </Text>
        <View style={styles.taskMeta}>
          <Text style={styles.metaText}>Created {formatTimeAgo(task.createdAt)}</Text>
          {task.startedAt && (
            <Text style={styles.metaText}> · Started {formatTimeAgo(task.startedAt)}</Text>
          )}
          {task.completedAt && (
            <Text style={styles.metaText}> · Done {formatTimeAgo(task.completedAt)}</Text>
          )}
        </View>
        <View style={styles.taskActions}>
          {isQueued && (
            <>
              <TouchableOpacity style={styles.reorderButton} onPress={onMoveUp}>
                <Text style={styles.reorderText}>▲</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.reorderButton} onPress={onMoveDown}>
                <Text style={styles.reorderText}>▼</Text>
              </TouchableOpacity>
            </>
          )}
          {canCancel && (
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

export function TaskQueueScreen({
  tasks,
  onCreateTask,
  onCancelTask,
  onMoveUp,
  onMoveDown,
  onBack,
}: Props) {
  const insets = useSafeAreaInsets();
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('normal');
  const [showForm, setShowForm] = useState(false);

  const queued = tasks.filter((t) => t.status === 'queued').length;
  const running = tasks.filter((t) => t.status === 'running').length;
  const completed = tasks.filter((t) => t.status === 'completed').length;

  function handleSubmit() {
    if (!newTitle.trim()) return;
    onCreateTask(newTitle.trim(), newDescription.trim(), newPriority);
    setNewTitle('');
    setNewDescription('');
    setNewPriority('normal');
    setShowForm(false);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Task Queue</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowForm((v) => !v)}
        >
          <Text style={styles.addButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{queued}</Text>
          <Text style={styles.statLabel}>Queued</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#3b82f6' }]}>{running}</Text>
          <Text style={styles.statLabel}>Running</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#22c55e' }]}>{completed}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TaskItem
            task={item}
            onCancel={() => onCancelTask(item.id)}
            onMoveUp={() => onMoveUp(item.id)}
            onMoveDown={() => onMoveDown(item.id)}
          />
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No tasks in queue. Add your first task!
          </Text>
        }
      />

      {showForm && (
        <View style={styles.form}>
          <Text style={styles.formTitle}>New Task</Text>
          <TextInput
            style={styles.input}
            placeholder="Title"
            placeholderTextColor="#475569"
            value={newTitle}
            onChangeText={setNewTitle}
          />
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder="Description"
            placeholderTextColor="#475569"
            value={newDescription}
            onChangeText={setNewDescription}
            multiline
            numberOfLines={3}
          />
          <View style={styles.priorityRow}>
            {PRIORITIES.map((p) => (
              <TouchableOpacity
                key={p}
                style={[
                  styles.priorityChip,
                  { borderColor: PRIORITY_COLORS[p] },
                  newPriority === p && { backgroundColor: PRIORITY_COLORS[p] + '33' },
                ]}
                onPress={() => setNewPriority(p)}
              >
                <Text
                  style={[
                    styles.priorityChipText,
                    { color: newPriority === p ? PRIORITY_COLORS[p] : '#94a3b8' },
                  ]}
                >
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.submitButton, !newTitle.trim() && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!newTitle.trim()}
          >
            <Text style={styles.submitButtonText}>Add Task</Text>
          </TouchableOpacity>
        </View>
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
  title: { flex: 1, fontSize: 20, fontWeight: 'bold', color: '#f8fafc' },
  addButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: 'bold', color: '#f8fafc' },
  statLabel: { fontSize: 12, color: '#64748b', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: '#334155', marginVertical: 4 },

  list: { padding: 16 },

  taskItem: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  priorityBar: { width: 4 },
  taskContent: { flex: 1, padding: 12 },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  taskTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#f8fafc',
    marginRight: 8,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusText: { fontSize: 11, fontWeight: '600' },
  taskDescription: { color: '#94a3b8', fontSize: 13, marginBottom: 6 },
  taskMeta: { flexDirection: 'row', marginBottom: 8 },
  metaText: { color: '#475569', fontSize: 11 },
  taskActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reorderButton: {
    backgroundColor: '#334155',
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderText: { color: '#94a3b8', fontSize: 14 },
  cancelButton: {
    backgroundColor: '#ef444422',
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  cancelText: { color: '#ef4444', fontSize: 12, fontWeight: '600' },

  emptyText: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },

  form: {
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    padding: 16,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f8fafc',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 12,
    color: '#f8fafc',
    fontSize: 14,
    marginBottom: 10,
  },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  priorityChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  priorityChipText: { fontSize: 12, fontWeight: '600' },
  submitButton: {
    backgroundColor: '#3b82f6',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
