import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Phase 3C tests: UI/UX improvements
 * - Issue 3-3: ConnectionBanner with safe area insets
 * - Issue 3-4: Keyboard dismiss on scroll (ChatScreen)
 * - Issue 3-5: Pull-to-refresh on list screens
 * - Bonus: ErrorBanner safe area insets fix
 */

const screensDir = join(__dirname, '..', 'screens');
const componentsDir = join(__dirname, '..', 'components');
const hooksDir = join(__dirname, '..', 'hooks');
const indexPath = join(__dirname, '..', 'index.tsx');

function readComponent(name: string): string {
  return readFileSync(join(componentsDir, name), 'utf-8');
}

function readScreen(name: string): string {
  return readFileSync(join(screensDir, name), 'utf-8');
}

function readFile(path: string): string {
  return readFileSync(path, 'utf-8');
}

// ─── Issue 3-3: ConnectionBanner ────────────────────────────

describe('Issue 3-3: ConnectionBanner', () => {
  const source = readComponent('ConnectionBanner.tsx');

  it('imports useSafeAreaInsets from react-native-safe-area-context', () => {
    expect(source).toContain("import { useSafeAreaInsets } from 'react-native-safe-area-context'");
  });

  it('calls useSafeAreaInsets() hook', () => {
    expect(source).toMatch(/const\s+insets\s*=\s*useSafeAreaInsets\(\)/);
  });

  it('uses insets.top for banner positioning', () => {
    expect(source).toContain('insets.top');
  });

  it('has reconnecting style with yellow background', () => {
    expect(source).toContain('#f59e0b');
  });

  it('has disconnected style with red background', () => {
    expect(source).toContain('#ef4444');
  });

  it('returns null for connected state', () => {
    expect(source).toMatch(/connectionState\s*===\s*['"]connected['"]/);
  });

  it('returns null for connecting state', () => {
    expect(source).toMatch(/connectionState\s*===\s*['"]connecting['"]/);
  });

  it('returns null on pair screen', () => {
    expect(source).toMatch(/currentScreen\s*===\s*['"]pair['"]/);
  });

  it('shows reconnecting text', () => {
    expect(source).toContain('Reconnecting...');
  });

  it('shows disconnected text', () => {
    expect(source).toContain('Disconnected');
  });

  it('has zIndex lower than ErrorBanner', () => {
    expect(source).toMatch(/zIndex:\s*999/);
  });

  it('uses absolute positioning', () => {
    expect(source).toContain("position: 'absolute'");
  });
});

// ─── Issue 3-3: ConnectionBanner in index.tsx ───────────────

describe('Issue 3-3: ConnectionBanner integration', () => {
  const source = readFile(indexPath);

  it('imports ConnectionBanner', () => {
    expect(source).toContain("import { ConnectionBanner }");
  });

  it('renders ConnectionBanner with connectionState prop', () => {
    expect(source).toContain('connectionState={doublt.connectionState}');
  });

  it('renders ConnectionBanner with currentScreen prop', () => {
    expect(source).toContain('currentScreen={currentScreen}');
  });
});

// ─── ErrorBanner safe area fix ──────────────────────────────

describe('ErrorBanner safe area fix', () => {
  const source = readComponent('ErrorBanner.tsx');

  it('imports useSafeAreaInsets from react-native-safe-area-context', () => {
    expect(source).toContain("import { useSafeAreaInsets } from 'react-native-safe-area-context'");
  });

  it('calls useSafeAreaInsets() hook', () => {
    expect(source).toMatch(/const\s+insets\s*=\s*useSafeAreaInsets\(\)/);
  });

  it('uses insets.top for dynamic positioning', () => {
    expect(source).toMatch(/top:\s*insets\.top\s*\+\s*8/);
  });

  it('has zIndex 1000 (above ConnectionBanner)', () => {
    expect(source).toMatch(/zIndex:\s*1000/);
  });
});

// ─── Issue 3-4: Keyboard dismiss on scroll ──────────────────

describe('Issue 3-4: Keyboard dismiss on drag', () => {
  const source = readScreen('ChatScreen.tsx');

  it('ChatScreen FlatList has keyboardDismissMode="on-drag"', () => {
    expect(source).toContain('keyboardDismissMode="on-drag"');
  });
});

// ─── Issue 3-5: Pull-to-refresh ─────────────────────────────

describe('Issue 3-5: Pull-to-refresh', () => {
  describe('WorkspaceListScreen', () => {
    const source = readScreen('WorkspaceListScreen.tsx');

    it('accepts onRefresh prop', () => {
      expect(source).toMatch(/onRefresh\??:\s*\(\)\s*=>\s*void/);
    });

    it('has refreshing state', () => {
      expect(source).toMatch(/useState.*false/);
      expect(source).toContain('refreshing');
    });

    it('FlatList has onRefresh prop', () => {
      expect(source).toMatch(/onRefresh=\{/);
    });

    it('FlatList has refreshing prop', () => {
      expect(source).toMatch(/refreshing=\{refreshing\}/);
    });
  });

  describe('SessionListScreen', () => {
    const source = readScreen('SessionListScreen.tsx');

    it('accepts onRefresh prop', () => {
      expect(source).toMatch(/onRefresh\??:\s*\(\)\s*=>\s*void/);
    });

    it('FlatList has onRefresh prop', () => {
      expect(source).toMatch(/onRefresh=\{/);
    });

    it('FlatList has refreshing prop', () => {
      expect(source).toMatch(/refreshing=\{refreshing\}/);
    });
  });

  describe('ApprovalQueueScreen', () => {
    const source = readScreen('ApprovalQueueScreen.tsx');

    it('accepts onRefresh prop', () => {
      expect(source).toMatch(/onRefresh\??:\s*\(\)\s*=>\s*void/);
    });

    it('FlatList has onRefresh prop', () => {
      expect(source).toMatch(/onRefresh=\{/);
    });

    it('FlatList has refreshing prop', () => {
      expect(source).toMatch(/refreshing=\{refreshing\}/);
    });
  });

  describe('TaskQueueScreen', () => {
    const source = readScreen('TaskQueueScreen.tsx');

    it('accepts onRefresh prop', () => {
      expect(source).toMatch(/onRefresh\??:\s*\(\)\s*=>\s*void/);
    });

    it('FlatList has onRefresh prop', () => {
      expect(source).toMatch(/onRefresh=\{/);
    });

    it('FlatList has refreshing prop', () => {
      expect(source).toMatch(/refreshing=\{refreshing\}/);
    });
  });
});

// ─── Pull-to-refresh callbacks in index.tsx ─────────────────

describe('Issue 3-5: Pull-to-refresh callbacks (index.tsx)', () => {
  const source = readFile(indexPath);

  it('WorkspaceListScreen onRefresh calls listWorkspaces()', () => {
    expect(source).toMatch(/onRefresh=\{.*?listWorkspaces/s);
  });

  it('WorkspaceListScreen onRefresh does NOT call selectWorkspace', () => {
    // Find the workspaces case block and check its onRefresh
    const workspacesBlock = source.match(/case 'workspaces':[\s\S]*?case 'sessions':/)?.[0] ?? '';
    expect(workspacesBlock).not.toMatch(/onRefresh=\{.*selectWorkspace/s);
  });

  it('SessionListScreen onRefresh is provided', () => {
    const sessionsBlock = source.match(/case 'sessions':[\s\S]*?case 'chat':/)?.[0] ?? '';
    expect(sessionsBlock).toMatch(/onRefresh=\{/);
  });

  it('ApprovalQueueScreen onRefresh calls listApprovalQueue()', () => {
    expect(source).toMatch(/onRefresh=\{.*?listApprovalQueue/s);
  });

  it('TaskQueueScreen onRefresh calls listTasks()', () => {
    expect(source).toMatch(/onRefresh=\{.*?listTasks/s);
  });

  it('TaskQueueScreen onRefresh does NOT call reorderTasks', () => {
    const taskBlock = source.match(/case 'taskQueue':[\s\S]*?case 'digest':/)?.[0] ?? '';
    expect(taskBlock).not.toMatch(/onRefresh=\{.*reorderTasks/s);
  });
});

// ─── useDoublt exposes listWorkspaces and listTasks ─────────

describe('useDoublt: listWorkspaces and listTasks exports', () => {
  const source = readFile(join(hooksDir, 'useDoublt.ts'));

  it('defines listWorkspaces callback', () => {
    expect(source).toMatch(/const\s+listWorkspaces\s*=\s*useCallback/);
  });

  it('listWorkspaces calls clientRef.current?.listWorkspaces()', () => {
    expect(source).toContain('clientRef.current?.listWorkspaces()');
  });

  it('defines listTasks callback', () => {
    expect(source).toMatch(/const\s+listTasks\s*=\s*useCallback/);
  });

  it('listTasks calls clientRef.current?.listTasks()', () => {
    expect(source).toContain('clientRef.current?.listTasks()');
  });

  it('exports listWorkspaces in return object', () => {
    const returnBlock = source.match(/return\s*\{[\s\S]*\};/)?.[0] ?? '';
    expect(returnBlock).toContain('listWorkspaces');
  });

  it('exports listTasks in return object', () => {
    const returnBlock = source.match(/return\s*\{[\s\S]*\};/)?.[0] ?? '';
    expect(returnBlock).toContain('listTasks');
  });
});
