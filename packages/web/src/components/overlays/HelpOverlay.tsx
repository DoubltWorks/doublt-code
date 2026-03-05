import { OverlayBackdrop } from './OverlayBackdrop';

interface HelpOverlayProps {
  onClose: () => void;
}

interface ShortcutGroup {
  title: string;
  shortcuts: Array<{ keys: string; description: string }>;
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'General',
    shortcuts: [
      { keys: 'Ctrl+K', description: 'Command palette' },
      { keys: 'Ctrl+B ?', description: 'Show this help' },
      { keys: 'Esc', description: 'Close overlay' },
    ],
  },
  {
    title: 'Sessions (Ctrl+B prefix)',
    shortcuts: [
      { keys: 'Ctrl+B c', description: 'New session' },
      { keys: 'Ctrl+B n', description: 'Next session' },
      { keys: 'Ctrl+B p', description: 'Previous session' },
      { keys: 'Ctrl+B w', description: 'Session list' },
    ],
  },
  {
    title: 'Panels & Views',
    shortcuts: [
      { keys: 'Ctrl+B d', description: 'Toggle sidebar' },
      { keys: 'Ctrl+B m', description: 'Mobile pairing' },
    ],
  },
];

export function HelpOverlay({ onClose }: HelpOverlayProps) {
  return (
    <OverlayBackdrop onClose={onClose} width={420}>
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        Keyboard Shortcuts
      </div>

      <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}>
        {SHORTCUT_GROUPS.map((group) => (
          <div key={group.title} style={{ marginBottom: 12 }}>
            <div
              style={{
                padding: '4px 16px',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
              }}
            >
              {group.title}
            </div>
            {group.shortcuts.map((sc) => (
              <div
                key={sc.keys}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '5px 16px',
                  fontSize: 12,
                }}
              >
                <span style={{ color: 'var(--text-secondary)' }}>{sc.description}</span>
                <kbd
                  style={{
                    background: 'var(--bg-surface)',
                    padding: '1px 6px',
                    borderRadius: 3,
                    fontSize: 11,
                    color: 'var(--accent)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {sc.keys}
                </kbd>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div
        style={{
          padding: '8px 16px',
          borderTop: '1px solid var(--border)',
          textAlign: 'center',
          fontSize: 11,
          color: 'var(--text-muted)',
        }}
      >
        Press Esc to close
      </div>
    </OverlayBackdrop>
  );
}
