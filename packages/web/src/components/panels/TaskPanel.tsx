import { useState, useEffect, useRef } from 'react';
import type { Task, TaskPriority } from '@doublt/shared';
import { EmptyState } from './EmptyState';

interface TaskPanelProps {
  tasks: Task[];
  onCreate: (title: string, description: string, priority: TaskPriority) => void;
  onUpdate: (taskId: string, updates: Partial<Pick<Task, 'status'>>) => void;
  onDelete: (taskId: string) => void;
}

const PRIORITY_LABELS: Record<string, string> = {
  critical: '!!',
  high: '!',
  normal: '',
  low: '',
};

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'critical', label: '!! Critical' },
  { value: 'high', label: '! High' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
];

function ElapsedTime({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    const update = () => {
      const diff = Math.floor((Date.now() - startedAt) / 1000);
      const m = Math.floor(diff / 60);
      const s = diff % 60;
      setElapsed(`${m}m ${s.toString().padStart(2, '0')}s`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>⏱ {elapsed}</span>;
}

export function TaskPanel({ tasks, onCreate, onUpdate, onDelete }: TaskPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [showCompleted, setShowCompleted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const running = tasks.filter((t) => t.status === 'running');
  const queued = tasks.filter((t) => t.status === 'queued');
  const completed = tasks.filter((t) => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled');

  const handleCreate = () => {
    const text = prompt.trim();
    if (!text) return;
    const lines = text.split('\n');
    const title = lines[0];
    const description = lines.slice(1).join('\n').trim();
    onCreate(title, description, priority);
    setPrompt('');
    setPriority('normal');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleCreate();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Running */}
      {running.map((task) => (
        <div
          key={task.id}
          style={{
            padding: '6px 8px',
            borderRadius: 4,
            background: 'rgba(var(--green-rgb, 80, 250, 123), 0.08)',
            border: '1px solid rgba(var(--green-rgb, 80, 250, 123), 0.25)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <span style={{ color: 'var(--green)', fontWeight: 700 }}>▶</span>
            {PRIORITY_LABELS[task.priority] && (
              <span style={{ color: task.priority === 'critical' ? 'var(--red)' : 'var(--yellow)', fontWeight: 700, fontSize: 10 }}>
                {PRIORITY_LABELS[task.priority]}
              </span>
            )}
            <span style={{ flex: 1, color: 'var(--text-primary)', fontWeight: 600 }}>{task.title}</span>
            <button
              onClick={() => onUpdate(task.id, { status: 'cancelled' })}
              style={{ fontSize: 9, padding: '1px 4px', background: 'transparent', color: 'var(--text-muted)' }}
            >
              Cancel
            </button>
          </div>
          {task.description && (
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {task.description}
            </div>
          )}
          {task.startedAt && (
            <div style={{ marginTop: 3 }}>
              <ElapsedTime startedAt={task.startedAt} />
            </div>
          )}
        </div>
      ))}

      {/* Queued */}
      {queued.length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 3 }}>
            Queued ({queued.length})
          </div>
          {queued.map((task, i) => (
            <div
              key={task.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 4px',
                fontSize: 11,
              }}
            >
              <span style={{ fontSize: 10, color: 'var(--text-muted)', width: 14, textAlign: 'right' }}>{i + 1}.</span>
              {PRIORITY_LABELS[task.priority] && (
                <span style={{ color: task.priority === 'critical' ? 'var(--red)' : 'var(--yellow)', fontWeight: 700, fontSize: 10 }}>
                  {PRIORITY_LABELS[task.priority]}
                </span>
              )}
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                {task.title}
              </span>
              <button
                onClick={() => onDelete(task.id)}
                style={{ fontSize: 9, padding: '1px 4px', background: 'transparent', color: 'var(--text-muted)' }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Completed/Failed */}
      {completed.length > 0 && (
        <div>
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span style={{ fontSize: 8 }}>{showCompleted ? '▼' : '▶'}</span>
            Completed ({completed.length})
          </button>
          {showCompleted &&
            completed.map((task) => (
              <div
                key={task.id}
                style={{
                  padding: '3px 4px',
                  fontSize: 11,
                  color: 'var(--text-muted)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{task.status === 'completed' ? '✓' : task.status === 'failed' ? '✗' : '—'}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: task.status === 'completed' ? 'line-through' : 'none' }}>
                    {task.title}
                  </span>
                  <button
                    onClick={() => onDelete(task.id)}
                    style={{ fontSize: 9, padding: '1px 4px', background: 'transparent', color: 'var(--text-muted)' }}
                  >
                    ×
                  </button>
                </div>
                {task.status === 'failed' && task.error && (
                  <div style={{ fontSize: 10, color: 'var(--status-crashed)', marginLeft: 18, marginTop: 2 }}>
                    {task.error}
                  </div>
                )}
                {task.status === 'completed' && task.result && (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 18, marginTop: 2 }}>
                    {task.result}
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {/* Empty state */}
      {tasks.length === 0 && (
        <EmptyState icon="[]" message="Queue empty — add prompts below" />
      )}

      {/* Input area */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2 }}>
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter prompt... (first line = title)"
          rows={3}
          style={{
            width: '100%',
            background: 'var(--bg-hover)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            color: 'var(--text-primary)',
            padding: '6px 8px',
            fontSize: 11,
            fontFamily: 'inherit',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
            style={{
              background: 'var(--bg-hover)',
              border: '1px solid var(--border)',
              borderRadius: 3,
              color: 'var(--text-primary)',
              fontSize: 10,
              padding: '3px 4px',
              fontFamily: 'inherit',
            }}
          >
            {PRIORITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            onClick={handleCreate}
            disabled={!prompt.trim()}
            style={{
              fontSize: 11,
              padding: '3px 10px',
              fontWeight: 600,
              opacity: prompt.trim() ? 1 : 0.4,
            }}
          >
            Add to Queue
          </button>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 'auto' }}>⌘↩</span>
        </div>
      </div>
    </div>
  );
}
