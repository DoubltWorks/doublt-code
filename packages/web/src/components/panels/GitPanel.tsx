import type { GitStatus, GitCommit } from '@doublt/shared';
import { EmptyState } from './EmptyState';
import { timeAgo } from '../../utils/time';

interface GitPanelProps {
  status: GitStatus | null;
  commits: GitCommit[];
  onRefresh: () => void;
}

function FileCount({ label, count, color }: { label: string; count: number; color: string }) {
  if (count === 0) return null;
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ color, fontWeight: 600 }}>{count}</span>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
    </span>
  );
}

export function GitPanel({ status, commits, onRefresh }: GitPanelProps) {
  if (!status) {
    return <EmptyState icon="*" message="No git data yet" />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Branch info */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{status.branch}</span>
        <div style={{ display: 'flex', gap: 6, fontSize: 10 }}>
          {status.ahead > 0 && (
            <span style={{ color: 'var(--green)' }}>+{status.ahead}</span>
          )}
          {status.behind > 0 && (
            <span style={{ color: 'var(--red)' }}>-{status.behind}</span>
          )}
          <button
            onClick={onRefresh}
            style={{
              padding: '0 4px',
              fontSize: 10,
              background: 'transparent',
              color: 'var(--text-muted)',
            }}
            title="Refresh"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* File counts */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 11 }}>
        <FileCount label="staged" count={status.staged.length} color="var(--green)" />
        <FileCount label="modified" count={status.unstaged.length} color="var(--yellow)" />
        <FileCount label="untracked" count={status.untracked.length} color="var(--text-muted)" />
      </div>

      {status.hasConflicts && (
        <div style={{ color: 'var(--red)', fontSize: 11, fontWeight: 600 }}>
          Merge conflicts detected
        </div>
      )}

      {/* Recent commits */}
      {commits.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div
            style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            Recent Commits
          </div>
          {commits.slice(0, 5).map((c) => (
            <div
              key={c.hash}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 6,
                fontSize: 11,
                padding: '2px 0',
                lineHeight: 1.3,
              }}
            >
              <span style={{ color: 'var(--yellow)', fontFamily: 'inherit', flexShrink: 0 }}>
                {c.shortHash}
              </span>
              <span
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: 'var(--text-primary)',
                }}
              >
                {c.message}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: 10, flexShrink: 0 }}>
                {timeAgo(c.date)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
