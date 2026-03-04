import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { GitStatus } from '@doublt/shared';

interface Props {
  gitStatus: GitStatus | null;
}

export function GitStatusBadge({ gitStatus }: Props) {
  if (!gitStatus) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.branch}>{gitStatus.branch}</Text>
      {gitStatus.ahead > 0 && (
        <Text style={styles.ahead}>+{gitStatus.ahead}</Text>
      )}
      {gitStatus.behind > 0 && (
        <Text style={styles.behind}>-{gitStatus.behind}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  branch: {
    color: '#3b82f6',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  ahead: {
    color: '#22c55e',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  behind: {
    color: '#ef4444',
    fontSize: 11,
    fontFamily: 'monospace',
  },
});
