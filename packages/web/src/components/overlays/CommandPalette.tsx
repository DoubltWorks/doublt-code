import { useState, useMemo, useEffect, useRef } from 'react';
import { OverlayBackdrop } from './OverlayBackdrop';

export interface PaletteCommand {
  id: string;
  label: string;
  shortcut?: string;
  category: string;
  action: () => void;
}

interface CommandPaletteProps {
  commands: PaletteCommand[];
  onClose: () => void;
}

export function CommandPalette({ commands, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || c.category.toLowerCase().includes(q),
    );
  }, [commands, query]);

  // Precompute flat index map from grouped data
  const { grouped, flatIndexMap } = useMemo(() => {
    const map = new Map<string, PaletteCommand[]>();
    for (const cmd of filtered) {
      const arr = map.get(cmd.category) || [];
      arr.push(cmd);
      map.set(cmd.category, arr);
    }
    const indexMap = new Map<string, number>();
    let idx = 0;
    for (const [, cmds] of map) {
      for (const cmd of cmds) {
        indexMap.set(cmd.id, idx++);
      }
    }
    return { grouped: map, flatIndexMap: indexMap };
  }, [filtered]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.querySelector(`[data-cmd-index="${selectedIndex}"]`) as HTMLElement;
    if (item) item.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const execute = (cmd: PaletteCommand) => {
    onClose();
    cmd.action();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filtered[selectedIndex]) {
          execute(filtered[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  };

  return (
    <OverlayBackdrop onClose={onClose} width={480}>
      {/* Search input */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a command..."
          style={{
            width: '100%',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            color: 'var(--text-primary)',
            padding: '8px 10px',
            fontSize: 13,
            fontFamily: 'inherit',
            outline: 'none',
          }}
        />
      </div>

      {/* Results */}
      <div ref={listRef} style={{ overflowY: 'auto', maxHeight: 320, padding: '4px 0' }}>
        {filtered.length === 0 && (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            No commands found
          </div>
        )}
        {[...grouped.entries()].map(([category, cmds]) => (
          <div key={category}>
            <div
              style={{
                padding: '6px 14px 2px',
                fontSize: 10,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                fontWeight: 600,
              }}
            >
              {category}
            </div>
            {cmds.map((cmd) => {
              const idx = flatIndexMap.get(cmd.id) ?? 0;
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  data-cmd-index={idx}
                  onClick={() => execute(cmd)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 14px',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--bg-surface)' : 'transparent',
                    borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                  }}
                >
                  <span style={{ fontSize: 12, color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    {cmd.label}
                  </span>
                  {cmd.shortcut && (
                    <kbd
                      style={{
                        fontSize: 10,
                        padding: '1px 5px',
                        background: 'var(--bg-hover)',
                        borderRadius: 3,
                        color: 'var(--text-muted)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {cmd.shortcut}
                    </kbd>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </OverlayBackdrop>
  );
}
