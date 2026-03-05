interface EmptyStateProps {
  icon?: string;
  message: string;
}

export function EmptyState({ icon = '--', message }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px 8px',
        color: 'var(--text-muted)',
        fontSize: 11,
        textAlign: 'center',
        gap: 4,
      }}
    >
      <span style={{ fontSize: 16, opacity: 0.6 }}>{icon}</span>
      <span>{message}</span>
    </div>
  );
}
