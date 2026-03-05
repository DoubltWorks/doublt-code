import { type ReactNode } from 'react';

interface OverlayBackdropProps {
  onClose: () => void;
  children: ReactNode;
  width?: number;
  ariaLabel?: string;
}

// Note: Escape key is handled centrally by useKeyboardShortcuts to avoid duplicate handlers
export function OverlayBackdrop({ onClose, children, width = 500, ariaLabel = 'Dialog' }: OverlayBackdropProps) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--overlay-backdrop)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onClick={(e) => e.stopPropagation()}
        style={{
          width,
          maxWidth: '90vw',
          maxHeight: '80vh',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </div>
    </div>
  );
}
