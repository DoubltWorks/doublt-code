import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { QuickAction, CommandMacro } from '@doublt/shared';

const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  test: 'flask',
  build: 'hammer',
  git: 'git-branch',
  check: 'checkmark',
  swap: 'swap-horizontal',
};

const DEFAULT_ACTIONS: QuickAction[] = [
  { id: 'qa-1', label: 'Run tests', icon: 'test', action: 'terminal_command', payload: 'npm test' },
  { id: 'qa-2', label: 'Build', icon: 'build', action: 'terminal_command', payload: 'npm run build' },
  { id: 'qa-3', label: 'Commit', icon: 'git', action: 'terminal_command', payload: 'git commit' },
  { id: 'qa-4', label: 'Approve All', icon: 'check', action: 'approve_all' },
  { id: 'qa-5', label: 'Handoff', icon: 'swap', action: 'trigger_handoff' },
];

interface Props {
  actions: QuickAction[];
  macros: CommandMacro[];
  onAction: (action: QuickAction) => void;
  onMacro: (macro: CommandMacro) => void;
}

export function QuickActionBar({ actions, macros, onAction, onMacro }: Props) {
  const allActions = [...DEFAULT_ACTIONS, ...actions];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {allActions.map((action) => (
        <TouchableOpacity
          key={action.id}
          style={styles.actionPill}
          onPress={() => onAction(action)}
        >
          <Ionicons
            name={ICON_MAP[action.icon] ?? 'ellipse'}
            size={14}
            color="#f8fafc"
          />
          <Text style={styles.actionLabel}>{action.label}</Text>
        </TouchableOpacity>
      ))}
      {macros.map((macro) => (
        <TouchableOpacity
          key={macro.id}
          style={styles.macroPill}
          onPress={() => onMacro(macro)}
        >
          <Ionicons name="terminal" size={14} color="#3b82f6" />
          <Text style={styles.macroLabel}>{macro.name}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#334155',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  actionLabel: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '500',
  },
  macroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e3a5f',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  macroLabel: {
    color: '#3b82f6',
    fontSize: 13,
    fontWeight: '500',
  },
});
