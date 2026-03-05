import type { UsageSummary, BudgetAlert } from '@doublt/shared';
import { EmptyState } from './EmptyState';

interface CostPanelProps {
  summary: UsageSummary | null;
  alerts: BudgetAlert[];
}

export function CostPanel({ summary, alerts }: CostPanelProps) {
  if (!summary) {
    return <EmptyState icon="$" message="No usage data yet" />;
  }

  const budgetPct =
    summary.budgetLimit && summary.budgetLimit > 0
      ? Math.min(1, summary.budgetUsed / summary.budgetLimit)
      : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Total cost today */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Today</span>
        <span style={{ color: 'var(--yellow)', fontWeight: 600, fontSize: 14 }}>
          ${summary.totalCostUsd.toFixed(2)}
        </span>
      </div>

      {/* Budget progress bar */}
      {budgetPct !== null && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
            <span style={{ color: 'var(--text-muted)' }}>Budget</span>
            <span style={{ color: 'var(--text-muted)' }}>
              ${summary.budgetUsed.toFixed(2)} / ${summary.budgetLimit!.toFixed(2)}
            </span>
          </div>
          <div
            style={{
              width: '100%',
              height: 4,
              background: 'var(--bg-hover)',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${budgetPct * 100}%`,
                height: '100%',
                background: budgetPct > 0.9 ? 'var(--red)' : budgetPct > 0.7 ? 'var(--yellow)' : 'var(--green)',
                borderRadius: 2,
                transition: 'width 0.3s',
              }}
            />
          </div>
        </div>
      )}

      {/* Per-session breakdown */}
      {summary.bySession.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
            By Session
          </div>
          {summary.bySession.map((s) => {
            const pct = summary.totalCostUsd > 0 ? s.costUsd / summary.totalCostUsd : 0;
            return (
              <div key={s.sessionId} style={{ marginBottom: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 1 }}>
                  <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.sessionName}
                  </span>
                  <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>${s.costUsd.toFixed(2)}</span>
                </div>
                <div style={{ width: '100%', height: 3, background: 'var(--bg-hover)', borderRadius: 2, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${pct * 100}%`,
                      height: '100%',
                      background: 'var(--accent)',
                      borderRadius: 2,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Budget alerts */}
      {alerts.filter((a) => a.triggered).map((alert) => (
        <div
          key={alert.id}
          style={{
            padding: '4px 6px',
            background: 'rgba(243, 139, 168, 0.1)',
            border: '1px solid var(--red)',
            borderRadius: 4,
            fontSize: 11,
            color: 'var(--red)',
          }}
        >
          {alert.message}
        </div>
      ))}
    </div>
  );
}
