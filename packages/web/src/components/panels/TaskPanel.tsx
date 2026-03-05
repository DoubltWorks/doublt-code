import { useState } from 'react';
import type { Task, TaskPriority } from '@doublt/shared';
import { EmptyState } from './EmptyState';

interface TaskPanelProps {
  tasks: Task[];
  onCreate: (title: string, description: string, priority: TaskPriority) => void;
  onUpdate: (taskId: string, updates: Partial<Pick<Task, 'status'>>) => void;
  onDelete: (taskId: string) => void;
}

const STATUS_ORDER = ['running', 'queued', 'completed', 'failed', 'cancelled'] as const;

const STATUS_COLORS: Record<string, string> = {
  running: 'var(--status-running)',
  queued: 'var(--status-queued)',
  completed: 'var(--text-muted)',
  failed: 'var(--status-crashed)',
  cancelled: 'var(--text-muted)',
};

const PRIORITY_LABELS: Record<string, string> = {
  critical: '!!',
  high: '!',
  normal: '',
  low: '',
};

export function TaskPanel({ tasks, onCreate, onUpdate, onDelete }: TaskPanelProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const handleCreate = () => {
    if (newTitle.trim()) {
      onCreate(newTitle.trim(), '', 'normal');
      setNewTitle('');
      setShowCreate(false);
    }
  };

  if (tasks.length === 0 && !showCreate) {
    return (
      <div>
        <EmptyState icon="[]" message="No tasks" />
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={() => setShowCreate(true)}
            style={{ fontSize: 11, padding: '3px 8px' }}
          >
            + Add Task
          </button>
        </div>
      </div>
    );
  }

  // Group by status
  const grouped = STATUS_ORDER.map((status) => ({
    status,
    items: tasks.filter((t) => t.status === status),
  })).filter((g) => g.items.length > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Inline create */}
      {showCreate ? (
        <div style={{ display: 'flex', gap: 4 }}>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') setShowCreate(false);
            }}
            placeholder="Task title..."
            autoFocus
            style={{
              flex: 1,
              background: 'var(--bg-hover)',
              border: '1px solid var(--accent)',
              borderRadius: 3,
              color: 'var(--text-primary)',
              padding: '3px 6px',
              fontSize: 11,
              fontFamily: 'inherit',
            }}
          />
          <button onClick={handleCreate} style={{ fontSize: 10, padding: '2px 6px' }}>Add</button>
        </div>
      ) : (
        <button
          onClick={() => setShowCreate(true)}
          style={{ fontSize: 10, padding: '2px 6px', alignSelf: 'flex-start', background: 'transparent', color: 'var(--text-muted)' }}
        >
          + Add Task
        </button>
      )}

      {grouped.map(({ status, items }) => (
        <div key={status}>
          <div style={{ fontSize: 10, color: STATUS_COLORS[status], textTransform: 'uppercase', marginBottom: 2 }}>
            {status} ({items.length})
          </div>
          {items.map((task) => (
            <div
              key={task.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 4px',
                fontSize: 11,
                borderRadius: 3,
              }}
            >
              {/* Priority indicator */}
              {PRIORITY_LABELS[task.priority] && (
                <span style={{ color: task.priority === 'critical' ? 'var(--red)' : 'var(--yellow)', fontWeight: 700, fontSize: 10 }}>
                  {PRIORITY_LABELS[task.priority]}
                </span>
              )}
              <span
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                  color: task.status === 'completed' ? 'var(--text-muted)' : 'var(--text-primary)',
                }}
              >
                {task.title}
              </span>

              {/* Quick actions */}
              {task.status === 'queued' && (
                <button
                  onClick={() => onUpdate(task.id, { status: 'running' })}
                  style={{ fontSize: 9, padding: '1px 4px', background: 'transparent', color: 'var(--green)' }}
                >
                  Run
                </button>
              )}
              {task.status === 'running' && (
                <button
                  onClick={() => onUpdate(task.id, { status: 'completed' })}
                  style={{ fontSize: 9, padding: '1px 4px', background: 'transparent', color: 'var(--green)' }}
                >
                  Done
                </button>
              )}
              <button
                onClick={() => onDelete(task.id)}
                style={{ fontSize: 9, padding: '1px 4px', background: 'transparent', color: 'var(--text-muted)' }}
              >
                x
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
