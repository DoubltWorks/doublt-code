import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Phase 3B tests: Icon library migration
 * - Issue 3-2: Replace text icons with Ionicons from @expo/vector-icons
 */

const screensDir = join(__dirname, '..', 'screens');
const componentsDir = join(__dirname, '..', 'components');

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

// Screens that have back buttons and thus need Ionicons
const screensWithIonicons = allScreens.filter(s => s !== 'PairScreen.tsx');

const iconComponents = [
  'ErrorBanner.tsx',
  'SearchBar.tsx',
  'VoiceInputButton.tsx',
  'QuickActionBar.tsx',
];

function readScreen(name: string): string {
  return readFileSync(join(screensDir, name), 'utf-8');
}

function readComponent(name: string): string {
  return readFileSync(join(componentsDir, name), 'utf-8');
}

describe('Phase 3B: Ionicons import', () => {
  it.each(screensWithIonicons)('%s imports Ionicons from @expo/vector-icons', (screen) => {
    const source = readScreen(screen);
    expect(source).toContain("import { Ionicons } from '@expo/vector-icons'");
  });

  it.each(iconComponents)('%s imports Ionicons from @expo/vector-icons', (component) => {
    const source = readComponent(component);
    expect(source).toContain("import { Ionicons } from '@expo/vector-icons'");
  });
});

describe('Phase 3B: No remaining text icons', () => {
  const allFiles = [
    ...allScreens.map(s => ({ name: s, read: () => readScreen(s) })),
    ...iconComponents.map(c => ({ name: c, read: () => readComponent(c) })),
  ];

  it('no text back arrow {\'<\'} remains in any file', () => {
    for (const { name, read } of allFiles) {
      const source = read();
      expect(source, `${name} still has text back arrow`).not.toMatch(/\{'<'\}/);
    }
  });

  it('no text back string {\'< Back\'} remains in any file', () => {
    for (const { name, read } of allFiles) {
      const source = read();
      expect(source, `${name} still has '< Back' text`).not.toMatch(/\{'< Back'\}/);
    }
  });

  it('no emoji icons remain (🔍, 😶, 💬, 🪟, 📁)', () => {
    for (const { name, read } of allFiles) {
      const source = read();
      expect(source, `${name} still has emoji icon`).not.toMatch(/[🔍😶💬🪟📁]/);
    }
  });

  it('no text close icon (X or ✕) remains as button content', () => {
    for (const { name, read } of allFiles) {
      const source = read();
      // Match >X</Text> or {'✕'} patterns
      expect(source, `${name} still has text close icon`).not.toMatch(/>X<\/Text>/);
      expect(source, `${name} still has ✕ icon`).not.toMatch(/\{'✕'\}/);
    }
  });

  it('no text "mic" or "cmd" icon remains', () => {
    const voiceSource = readComponent('VoiceInputButton.tsx');
    // Ensure no <Text>mic</Text> or <Text>...</Text> patterns (Ionicons name props are fine)
    expect(voiceSource).not.toMatch(/>mic<\/Text>/);
    expect(voiceSource).not.toMatch(/>\.\.\.<\/Text>/);

    const quickSource = readComponent('QuickActionBar.tsx');
    expect(quickSource).not.toMatch(/\{'cmd'\}/);
  });

  it('no text arrow icons ▲▼ remain', () => {
    const taskSource = readScreen('TaskQueueScreen.tsx');
    expect(taskSource).not.toContain('▲');
    expect(taskSource).not.toContain('▼');
  });

  it('no "+ New" text pattern remains (should be Ionicons add + text)', () => {
    for (const { name, read } of allFiles) {
      const source = read();
      expect(source, `${name} still has "+ New" text`).not.toMatch(/>\+ New/);
    }
  });
});

describe('Phase 3B: Ionicons usage patterns', () => {
  it('back buttons use chevron-back icon', () => {
    const backScreens = [
      'TerminalScreen.tsx', 'DigestScreen.tsx', 'GitStatusScreen.tsx',
      'TaskQueueScreen.tsx', 'ActivityTimelineScreen.tsx', 'UsageDashboardScreen.tsx',
      'ChatScreen.tsx', 'SessionListScreen.tsx', 'NotificationScreen.tsx',
      'ApprovalQueueScreen.tsx', 'ApprovalPolicyScreen.tsx',
      'SearchScreen.tsx', 'TemplateScreen.tsx', 'MacroScreen.tsx',
    ];
    for (const screen of backScreens) {
      const source = readScreen(screen);
      expect(source, `${screen} missing chevron-back icon`).toContain('name="chevron-back"');
    }
  });

  it('SearchBar uses Ionicons search and close-circle', () => {
    const source = readComponent('SearchBar.tsx');
    expect(source).toContain('name="search"');
    expect(source).toContain('name="close-circle"');
  });

  it('ErrorBanner uses Ionicons close', () => {
    const source = readComponent('ErrorBanner.tsx');
    expect(source).toContain('name="close"');
  });

  it('VoiceInputButton uses Ionicons mic and ellipsis-horizontal', () => {
    const source = readComponent('VoiceInputButton.tsx');
    expect(source).toContain("'mic'");
    expect(source).toContain("'ellipsis-horizontal'");
  });

  it('QuickActionBar uses Ionicons for action icons and terminal for macros', () => {
    const source = readComponent('QuickActionBar.tsx');
    expect(source).toContain('ICON_MAP');
    expect(source).toContain('name="terminal"');
  });

  it('SearchScreen uses Ionicons for type icons and empty states', () => {
    const source = readScreen('SearchScreen.tsx');
    expect(source).toContain('TYPE_ICON_NAMES');
    expect(source).toContain('name="search"');
    expect(source).toContain('name="sad-outline"');
  });

  it('create/add buttons use Ionicons add icon', () => {
    const workspace = readScreen('WorkspaceListScreen.tsx');
    const session = readScreen('SessionListScreen.tsx');
    const task = readScreen('TaskQueueScreen.tsx');
    expect(workspace).toContain('name="add"');
    expect(session).toContain('name="add"');
    expect(task).toContain('name="add"');
  });

  it('TaskQueueScreen reorder uses chevron-up and chevron-down', () => {
    const source = readScreen('TaskQueueScreen.tsx');
    expect(source).toContain('name="chevron-up"');
    expect(source).toContain('name="chevron-down"');
  });

  it('TemplateScreen form close uses Ionicons close', () => {
    const source = readScreen('TemplateScreen.tsx');
    expect(source).toContain('name="close"');
  });
});
