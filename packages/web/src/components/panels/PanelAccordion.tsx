import { type ReactNode } from 'react';

interface PanelAccordionProps {
  id: string;
  title: string;
  badge?: string | number;
  badgeColor?: string;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  children: ReactNode;
}

export function PanelAccordion({
  id,
  title,
  badge,
  badgeColor,
  isExpanded,
  onToggle,
  children,
}: PanelAccordionProps) {
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button
        onClick={() => onToggle(id)}
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          padding: '6px 10px',
          background: 'var(--bg-secondary)',
          color: 'var(--text-secondary)',
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          border: 'none',
          borderRadius: 0,
          cursor: 'pointer',
          gap: 6,
        }}
      >
        <span style={{ fontSize: 10, width: 12, textAlign: 'center' }}>
          {isExpanded ? '\u25BC' : '\u25B6'}
        </span>
        <span style={{ flex: 1, textAlign: 'left' }}>{title}</span>
        {badge !== undefined && badge !== 0 && (
          <span
            style={{
              fontSize: 10,
              padding: '1px 5px',
              borderRadius: 8,
              background: badgeColor || 'var(--bg-hover)',
              color: badgeColor ? 'var(--bg-primary)' : 'var(--text-muted)',
              fontWeight: 600,
              minWidth: 16,
              textAlign: 'center',
            }}
          >
            {badge}
          </span>
        )}
      </button>
      {isExpanded && (
        <div style={{ padding: '6px 10px', fontSize: 12 }}>{children}</div>
      )}
    </div>
  );
}
