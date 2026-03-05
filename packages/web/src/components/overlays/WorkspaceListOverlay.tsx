import { useState } from 'react';
import type { WorkspaceListItem } from '@doublt/shared';
import { OverlayBackdrop } from './OverlayBackdrop';

interface WorkspaceListOverlayProps {
  workspaces: WorkspaceListItem[];
  activeWorkspaceId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name?: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onClose: () => void;
}

export function WorkspaceListOverlay({
  workspaces,
  activeWorkspaceId,
  onSelect,
  onCreate,
  onDelete,
  onRename,
  onClose,
}: WorkspaceListOverlayProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const startRename = (w: WorkspaceListItem) => {
    setEditingId(w.id);
    setEditValue(w.name);
  };

  const commitRename = () => {
    if (editingId && editValue.trim()) {
      onRename(editingId, editValue.trim());
    }
    setEditingId(null);
  };

  return (
    <OverlayBackdrop onClose={onClose} width={450}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 14 }}>Workspaces</span>
        <button
          onClick={() => onCreate()}
          style={{ fontSize: 12, padding: '3px 10px' }}
        >
          + New
        </button>
      </div>

      {/* List */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
        {workspaces.length === 0 && (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            No workspaces yet
          </div>
        )}
        {workspaces.map((w) => {
          const isActive = w.id === activeWorkspaceId;
          const isEditing = editingId === w.id;
          return (
            <div
              key={w.id}
              onClick={() => {
                if (!isEditing) {
                  onSelect(w.id);
                  onClose();
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 16px',
                cursor: isEditing ? 'default' : 'pointer',
                background: isActive ? 'var(--bg-surface)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                {isEditing ? (
                  <input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename();
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    autoFocus
                    style={{
                      background: 'var(--bg-hover)',
                      border: '1px solid var(--accent)',
                      borderRadius: 3,
                      color: 'var(--text-primary)',
                      padding: '2px 6px',
                      fontSize: 12,
                      width: '100%',
                      fontFamily: 'inherit',
                    }}
                  />
                ) : (
                  <>
                    <div style={{ fontSize: 13, color: isActive ? 'var(--accent)' : 'var(--text-primary)' }}>
                      {w.index}: {w.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                      {w.cwd} | {w.activeSessionCount}/{w.sessionCount} sessions
                    </div>
                  </>
                )}
              </div>

              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startRename(w);
                  }}
                  style={{ fontSize: 10, padding: '2px 6px', background: 'transparent', color: 'var(--text-muted)' }}
                >
                  Rename
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(w.id);
                  }}
                  style={{ fontSize: 10, padding: '2px 6px', background: 'transparent', color: 'var(--red)' }}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </OverlayBackdrop>
  );
}
