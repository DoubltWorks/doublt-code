import type { ApprovalQueueItem } from '@doublt/shared';
import { EmptyState } from './EmptyState';
import { timeAgo } from '../../utils/time';

interface ApprovalPanelProps {
  queue: ApprovalQueueItem[];
  onDecide: (queueItemId: string, approved: boolean) => void;
}

const RISK_COLORS: Record<string, string> = {
  low: 'var(--risk-low)',
  medium: 'var(--risk-medium)',
  high: 'var(--risk-high)',
};

const SENSITIVE_KEYS = /password|token|secret|key|credential|auth/i;

function redactSensitive(input: unknown): unknown {
  if (typeof input !== 'object' || input === null) return input;
  if (Array.isArray(input)) return input.map(redactSensitive);
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    result[k] = SENSITIVE_KEYS.test(k) ? '[REDACTED]' : redactSensitive(v);
  }
  return result;
}

export function ApprovalPanel({ queue, onDecide }: ApprovalPanelProps) {
  const pending = queue.filter((q) => q.status === 'pending');
  const decided = queue.filter((q) => q.status !== 'pending');

  if (queue.length === 0) {
    return <EmptyState icon="OK" message="No approval requests" />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Pending items */}
      {pending.map((item) => (
        <div
          key={item.id}
          style={{
            padding: '6px 8px',
            background: 'var(--bg-surface)',
            borderRadius: 4,
            border: `1px solid ${RISK_COLORS[item.riskLevel] || 'var(--border)'}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span
              style={{
                fontSize: 9,
                padding: '1px 5px',
                borderRadius: 4,
                background: RISK_COLORS[item.riskLevel] || 'var(--bg-hover)',
                color: 'var(--bg-primary)',
                fontWeight: 600,
                textTransform: 'uppercase',
              }}
            >
              {item.riskLevel}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
              {item.toolName}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {timeAgo(item.createdAt)}
            </span>
          </div>

          {/* Input preview */}
          <div
            style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              marginBottom: 6,
              maxHeight: 40,
              overflow: 'hidden',
              fontFamily: 'inherit',
            }}
          >
            {JSON.stringify(redactSensitive(item.input)).slice(0, 120)}
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => onDecide(item.id, true)}
              style={{
                flex: 1,
                fontSize: 11,
                padding: '3px 8px',
                background: 'rgba(166, 227, 161, 0.15)',
                color: 'var(--green)',
              }}
            >
              Approve
            </button>
            <button
              onClick={() => onDecide(item.id, false)}
              style={{
                flex: 1,
                fontSize: 11,
                padding: '3px 8px',
                background: 'rgba(243, 139, 168, 0.15)',
                color: 'var(--red)',
              }}
            >
              Reject
            </button>
          </div>
        </div>
      ))}

      {/* Recent decisions */}
      {decided.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>
            Recent
          </div>
          {decided.slice(-5).map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                padding: '2px 0',
                color: 'var(--text-muted)',
              }}
            >
              <span style={{ color: item.status === 'approved' ? 'var(--green)' : 'var(--red)' }}>
                {item.status === 'approved' ? 'V' : 'X'}
              </span>
              <span>{item.toolName}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
