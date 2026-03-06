/**
 * ApprovalPolicyScreen — Mobile screen for managing approval policies.
 *
 * Shows preset buttons for quick setup and a list of all policies.
 * Tapping a policy sets it as the active policy.
 */

import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import type { ApprovalPolicy, ApprovalPreset } from '@doublt/shared/src/types/approval.js';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  policies: ApprovalPolicy[];
  activePolicyId: string | null;
  onSetActive: (policyId: string) => void;
  onApplyPreset: (preset: ApprovalPreset) => void;
  onBack: () => void;
}

const PRESETS: { label: string; value: ApprovalPreset }[] = [
  { label: 'Conservative', value: 'conservative' },
  { label: 'Moderate', value: 'moderate' },
  { label: 'Permissive', value: 'permissive' },
];

function PolicyCard({
  policy,
  isActive,
  onSetActive,
}: {
  policy: ApprovalPolicy;
  isActive: boolean;
  onSetActive: (id: string) => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.card, isActive && styles.cardActive]}
      onPress={() => onSetActive(policy.id)}
      activeOpacity={0.75}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.policyName}>{policy.name}</Text>
        {isActive && <View style={styles.activeDot} />}
      </View>
      <Text style={styles.policyDescription} numberOfLines={2}>
        {policy.description}
      </Text>
      <Text style={styles.ruleCount}>
        {policy.rules.length} rule{policy.rules.length !== 1 ? 's' : ''}
      </Text>
    </TouchableOpacity>
  );
}

export function ApprovalPolicyScreen({
  policies,
  activePolicyId,
  onSetActive,
  onApplyPreset,
  onBack,
}: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Approval Policies</Text>
      </View>

      {/* Preset buttons */}
      <View style={styles.presetsSection}>
        <Text style={styles.sectionLabel}>Quick Presets</Text>
        <View style={styles.presetRow}>
          {PRESETS.map(({ label, value }) => (
            <TouchableOpacity
              key={value}
              style={styles.presetButton}
              onPress={() => onApplyPreset(value)}
            >
              <Text style={styles.presetButtonText}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Policy list */}
      <Text style={[styles.sectionLabel, styles.sectionLabelPadded]}>Policies</Text>
      {policies.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No policies. Apply a preset to get started.</Text>
        </View>
      ) : (
        <FlatList
          data={policies}
          keyExtractor={(item: ApprovalPolicy) => item.id}
          renderItem={({ item }: { item: ApprovalPolicy }) => (
            <PolicyCard
              policy={item}
              isActive={item.id === activePolicyId}
              onSetActive={onSetActive}
            />
          )}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backButton: { padding: 8, marginRight: 8 },
  backText: { color: '#3b82f6', fontSize: 20 },
  headerTitle: { flex: 1, color: '#f8fafc', fontSize: 18, fontWeight: '600' },
  presetsSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  sectionLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 10 },
  sectionLabelPadded: { paddingHorizontal: 16, marginTop: 16 },
  presetRow: { flexDirection: 'row', gap: 8 },
  presetButton: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  presetButtonText: { color: '#f8fafc', fontSize: 13, fontWeight: '500' },
  listContent: { padding: 16 },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardActive: { borderColor: '#3b82f6' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  policyName: { flex: 1, color: '#f8fafc', fontSize: 16, fontWeight: '600' },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22c55e',
  },
  policyDescription: { color: '#94a3b8', fontSize: 13, lineHeight: 18, marginBottom: 8 },
  ruleCount: { color: '#64748b', fontSize: 12 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { color: '#64748b', fontSize: 15, textAlign: 'center' },
});
