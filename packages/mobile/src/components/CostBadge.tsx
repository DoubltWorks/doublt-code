import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  costUsd: number;
  budgetUsedPercent?: number; // 0-1
}

function badgeColor(costUsd: number): string {
  if (costUsd < 1) return '#22c55e';
  if (costUsd <= 5) return '#f59e0b';
  return '#ef4444';
}

export function CostBadge({ costUsd, budgetUsedPercent }: Props) {
  const bg = badgeColor(costUsd);
  const overBudget = budgetUsedPercent !== undefined && budgetUsedPercent > 0.8;

  return (
    <View style={[styles.badge, { backgroundColor: bg }, overBudget && styles.warningBorder]}>
      <Text style={styles.label}>{`$${costUsd.toFixed(2)}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    borderWidth: 0,
  },
  warningBorder: {
    borderWidth: 1.5,
    borderColor: '#ef4444',
  },
  label: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'monospace' as any,
    fontWeight: '600',
  },
});
