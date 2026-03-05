import { useCallback, useRef, useEffect, useState, type ReactNode } from 'react';

interface SidebarProps {
  isOpen: boolean;
  width: number;
  onResize: (width: number) => void;
  children: ReactNode;
}

export function Sidebar({ isOpen, width, onResize, children }: SidebarProps) {
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      draggingRef.current = true;
      startXRef.current = e.clientX;
      startWidthRef.current = width;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [width],
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const delta = startXRef.current - e.clientX;
      onResize(startWidthRef.current + delta);
    };

    const handleMouseUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onResize]);

  if (!isOpen) return null;

  return (
    <div style={{ display: 'flex', flexShrink: 0 }}>
      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 20 : 4;
          if (e.key === 'ArrowLeft') { e.preventDefault(); onResize(width + step); }
          else if (e.key === 'ArrowRight') { e.preventDefault(); onResize(width - step); }
        }}
        className="divider-h"
        role="separator"
        tabIndex={0}
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        style={{ width: 4, minWidth: 4 }}
      />
      {/* Panel content */}
      <div
        style={{
          width: width - 4,
          background: 'var(--bg-secondary)',
          borderLeft: '1px solid var(--border)',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
}
