import { useRef, useCallback } from 'react';
import type { PaneNode } from '../hooks/usePaneLayout';
import { Terminal } from './Terminal';
import type { ClientMessage, ServerMessage } from '@doublt/shared';

interface PaneContainerProps {
  node: PaneNode;
  activePaneId: string;
  onPaneFocus: (paneId: string) => void;
  onResize: (splitId: string, ratio: number) => void;
  send: (msg: ClientMessage) => void;
  subscribe: (handler: (msg: ServerMessage) => void) => () => void;
}

export function PaneContainer({
  node,
  activePaneId,
  onPaneFocus,
  onResize,
  send,
  subscribe,
}: PaneContainerProps) {
  if (node.type === 'terminal') {
    return (
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        <Terminal
          sessionId={node.sessionId}
          isActive={node.id === activePaneId}
          send={send}
          subscribe={subscribe}
          onFocus={() => onPaneFocus(node.id)}
        />
      </div>
    );
  }

  // Split node — render two children with a draggable divider
  return (
    <SplitView
      node={node}
      activePaneId={activePaneId}
      onPaneFocus={onPaneFocus}
      onResize={onResize}
      send={send}
      subscribe={subscribe}
    />
  );
}

function SplitView({
  node,
  activePaneId,
  onPaneFocus,
  onResize,
  send,
  subscribe,
}: {
  node: Extract<PaneNode, { type: 'split' }>;
  activePaneId: string;
  onPaneFocus: (paneId: string) => void;
  onResize: (splitId: string, ratio: number) => void;
  send: (msg: ClientMessage) => void;
  subscribe: (handler: (msg: ServerMessage) => void) => () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const isHorizontal = node.direction === 'horizontal';

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      draggingRef.current = true;
      const dividerEl = e.currentTarget as HTMLElement;
      dividerEl.classList.add('active');

      const onMouseMove = (ev: MouseEvent) => {
        if (!containerRef.current || !draggingRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        let ratio: number;
        if (isHorizontal) {
          ratio = (ev.clientX - rect.left) / rect.width;
        } else {
          ratio = (ev.clientY - rect.top) / rect.height;
        }
        onResize(node.id, ratio);
      };

      const onMouseUp = () => {
        draggingRef.current = false;
        dividerEl.classList.remove('active');
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [isHorizontal, node.id, onResize],
  );

  const pct1 = `${node.ratio * 100}%`;
  const pct2 = `${(1 - node.ratio) * 100}%`;

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: isHorizontal ? 'row' : 'column',
        width: '100%',
        height: '100%',
      }}
    >
      <div style={{ [isHorizontal ? 'width' : 'height']: pct1, overflow: 'hidden' }}>
        <PaneContainer
          node={node.children[0]}
          activePaneId={activePaneId}
          onPaneFocus={onPaneFocus}
          onResize={onResize}
          send={send}
          subscribe={subscribe}
        />
      </div>

      <div
        className={isHorizontal ? 'divider-h' : 'divider-v'}
        onMouseDown={handleMouseDown}
      />

      <div style={{ [isHorizontal ? 'width' : 'height']: pct2, overflow: 'hidden' }}>
        <PaneContainer
          node={node.children[1]}
          activePaneId={activePaneId}
          onPaneFocus={onPaneFocus}
          onResize={onResize}
          send={send}
          subscribe={subscribe}
        />
      </div>
    </div>
  );
}
