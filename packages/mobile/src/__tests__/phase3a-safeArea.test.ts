import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Phase 3A tests: SafeAreaView migration
 * - Issue 3-1: Replace hardcoded paddingTop with useSafeAreaInsets()
 */

const screensDir = join(__dirname, '..', 'screens');
const indexPath = join(__dirname, '..', 'index.tsx');

const allScreens = [
  'PairScreen.tsx',
  'WorkspaceListScreen.tsx',
  'SessionListScreen.tsx',
  'ChatScreen.tsx',
  'TerminalScreen.tsx',
  'NotificationScreen.tsx',
  'ApprovalQueueScreen.tsx',
  'ApprovalPolicyScreen.tsx',
  'TaskQueueScreen.tsx',
  'DigestScreen.tsx',
  'ActivityTimelineScreen.tsx',
  'GitStatusScreen.tsx',
  'UsageDashboardScreen.tsx',
  'SearchScreen.tsx',
  'TemplateScreen.tsx',
  'MacroScreen.tsx',
];

// Screens that previously had paddingTop: 60 in container style
const paddingTop60Screens = [
  'WorkspaceListScreen.tsx',
  'SessionListScreen.tsx',
  'ChatScreen.tsx',
  'NotificationScreen.tsx',
  'ApprovalQueueScreen.tsx',
  'ApprovalPolicyScreen.tsx',
  'TaskQueueScreen.tsx',
  'DigestScreen.tsx',
  'ActivityTimelineScreen.tsx',
  'GitStatusScreen.tsx',
  'UsageDashboardScreen.tsx',
];

function readScreen(name: string): string {
  return readFileSync(join(screensDir, name), 'utf-8');
}

// ─── SafeAreaProvider wrapping ────

describe('SafeAreaProvider wrapping', () => {
  it('index.tsx imports SafeAreaProvider', () => {
    const content = readFileSync(indexPath, 'utf-8');
    expect(content).toContain("import { SafeAreaProvider } from 'react-native-safe-area-context'");
  });

  it('index.tsx wraps app with SafeAreaProvider', () => {
    const content = readFileSync(indexPath, 'utf-8');
    expect(content).toContain('<SafeAreaProvider>');
    expect(content).toContain('</SafeAreaProvider>');
  });
});

// ─── useSafeAreaInsets import in all screens ────

describe('useSafeAreaInsets import', () => {
  for (const screen of allScreens) {
    it(`${screen} imports useSafeAreaInsets`, () => {
      const content = readScreen(screen);
      expect(content).toContain('useSafeAreaInsets');
      expect(content).toContain("from 'react-native-safe-area-context'");
    });
  }
});

// ─── useSafeAreaInsets hook usage ────

describe('useSafeAreaInsets hook usage', () => {
  for (const screen of allScreens) {
    it(`${screen} calls useSafeAreaInsets()`, () => {
      const content = readScreen(screen);
      expect(content).toMatch(/const\s+insets\s*=\s*useSafeAreaInsets\(\)/);
    });
  }
});

// ─── paddingTop: 60 removal ────

describe('paddingTop: 60 removal', () => {
  for (const screen of paddingTop60Screens) {
    it(`${screen} no longer has paddingTop: 60 in styles`, () => {
      const content = readScreen(screen);
      // Check StyleSheet.create section only (after the last component return)
      const styleSection = content.slice(content.lastIndexOf('StyleSheet.create'));
      expect(styleSection).not.toMatch(/paddingTop:\s*60/);
    });
  }
});

// ─── Special case: PairScreen ────

describe('PairScreen special case', () => {
  it('no longer has paddingTop: 100 in styles', () => {
    const content = readScreen('PairScreen.tsx');
    const styleSection = content.slice(content.lastIndexOf('StyleSheet.create'));
    expect(styleSection).not.toMatch(/paddingTop:\s*100/);
  });

  it('uses insets.top + 40 for content padding', () => {
    const content = readScreen('PairScreen.tsx');
    expect(content).toMatch(/insets\.top\s*\+\s*40/);
  });
});

// ─── Special case: TerminalScreen ────

describe('TerminalScreen special case', () => {
  it('no longer has paddingTop: 56 in styles', () => {
    const content = readScreen('TerminalScreen.tsx');
    const styleSection = content.slice(content.lastIndexOf('StyleSheet.create'));
    expect(styleSection).not.toMatch(/paddingTop:\s*56/);
  });

  it('uses insets.top for header padding', () => {
    const content = readScreen('TerminalScreen.tsx');
    expect(content).toMatch(/paddingTop:\s*insets\.top/);
  });
});

// ─── Dynamic paddingTop via insets.top ────

describe('insets.top usage in container/screen styles', () => {
  for (const screen of allScreens) {
    it(`${screen} uses insets.top for paddingTop`, () => {
      const content = readScreen(screen);
      expect(content).toMatch(/insets\.top/);
    });
  }
});

// ─── ActivityTimelineScreen emptyContainer paddingTop preserved ────

describe('ActivityTimelineScreen emptyContainer', () => {
  it('preserves paddingTop: 80 in emptyContainer style', () => {
    const content = readScreen('ActivityTimelineScreen.tsx');
    const styleSection = content.slice(content.lastIndexOf('StyleSheet.create'));
    expect(styleSection).toMatch(/paddingTop:\s*80/);
  });
});
