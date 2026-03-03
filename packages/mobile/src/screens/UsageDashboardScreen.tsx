/**
 * UsageDashboardScreen — Token usage and cost tracking for mobile.
 *
 * Shows daily/weekly/monthly cost summaries, a budget gauge, per-session
 * cost breakdown, and a 7-day daily trend chart.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from 'react-native';
import type { UsageSummary, BudgetConfig } from '@doublt/shared/src/types/cost.js';

interface Props {
  usageSummary: UsageSummary | null;
  budgetConfig: BudgetConfig | null;
  onSetBudget: (dailyLimit: number) => void;
  onRefresh: () => void;
  onBack: () => void;
}

function formatCost(usd: number): string {
  return `$${usd.toFixed(2)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function costColor(usd: number): string {
  if (usd < 1) return '#22c55e';
  if (usd <= 5) return '#f59e0b';
  return '#ef4444';
}

function gaugeColor(ratio: number): string {
  if (ratio < 0.6) return '#22c55e';
  if (ratio <= 0.85) return '#f59e0b';
  return '#ef4444';
}

// Simple summary cards shown at the top
function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryCardValue}>{value}</Text>
      <Text style={styles.summaryCardLabel}>{label}</Text>
    </View>
  );
}

// Horizontal budget bar gauge
function BudgetGauge({
  used,
  limit,
  budgetInput,
  onBudgetInputChange,
  onSetBudget,
}: {
  used: number;
  limit: number | null;
  budgetInput: string;
  onBudgetInputChange: (v: string) => void;
  onSetBudget: () => void;
}) {
  const ratio = limit !== null && limit > 0 ? Math.min(used / limit, 1) : 0;
  const color = gaugeColor(ratio);
  const pct = Math.round(ratio * 100);

  return (
    <View style={styles.gaugeCard}>
      <Text style={styles.sectionTitle}>Daily Budget</Text>
      {limit !== null ? (
        <>
          <View style={styles.gaugeTrack}>
            <View style={[styles.gaugeFill, { width: `${pct}%` as any, backgroundColor: color }]} />
          </View>
          <View style={styles.gaugeLabels}>
            <Text style={[styles.gaugeUsed, { color }]}>{formatCost(used)}</Text>
            <Text style={styles.gaugeLimit}>of {formatCost(limit)}</Text>
            <Text style={[styles.gaugePct, { color }]}>{pct}%</Text>
          </View>
        </>
      ) : (
        <Text style={styles.noBudgetText}>No daily budget set</Text>
      )}
      <View style={styles.budgetInputRow}>
        <TextInput
          style={styles.budgetInput}
          value={budgetInput}
          onChangeText={onBudgetInputChange}
          placeholder="Daily limit (USD)"
          placeholderTextColor="#475569"
          keyboardType="decimal-pad"
        />
        <TouchableOpacity style={styles.budgetSetButton} onPress={onSetBudget}>
          <Text style={styles.budgetSetButtonText}>Set</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// A single session row with a proportional cost bar
function SessionRow({
  sessionName,
  costUsd,
  tokens,
  maxCost,
}: {
  sessionName: string;
  costUsd: number;
  tokens: number;
  maxCost: number;
}) {
  const barWidth = maxCost > 0 ? Math.max((costUsd / maxCost) * 100, 2) : 0;
  const color = costColor(costUsd);

  return (
    <View style={styles.sessionRow}>
      <View style={styles.sessionRowHeader}>
        <Text style={styles.sessionName} numberOfLines={1}>{sessionName}</Text>
        <View style={styles.sessionRowRight}>
          <Text style={[styles.sessionCost, { color }]}>{formatCost(costUsd)}</Text>
          <Text style={styles.sessionTokens}>{formatTokens(tokens)}</Text>
        </View>
      </View>
      <View style={styles.sessionBarTrack}>
        <View style={[styles.sessionBarFill, { width: `${barWidth}%` as any, backgroundColor: color }]} />
      </View>
    </View>
  );
}

// A single day row for the trend chart
function DayRow({
  date,
  costUsd,
  tokens,
  maxCost,
}: {
  date: string;
  costUsd: number;
  tokens: number;
  maxCost: number;
}) {
  const barWidth = maxCost > 0 ? Math.max((costUsd / maxCost) * 100, 2) : 0;
  const color = costColor(costUsd);
  const label = date.slice(5); // MM-DD

  return (
    <View style={styles.dayRow}>
      <Text style={styles.dayLabel}>{label}</Text>
      <View style={styles.dayBarTrack}>
        <View style={[styles.dayBarFill, { width: `${barWidth}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[styles.dayCost, { color }]}>{formatCost(costUsd)}</Text>
    </View>
  );
}

export function UsageDashboardScreen({
  usageSummary,
  budgetConfig,
  onSetBudget,
  onRefresh,
  onBack,
}: Props) {
  const [budgetInput, setBudgetInput] = useState('');

  function handleSetBudget() {
    const val = parseFloat(budgetInput);
    if (!isNaN(val) && val > 0) {
      onSetBudget(val);
      setBudgetInput('');
    }
  }

  // Derive top-line numbers from summary
  const todayCost = usageSummary?.byDay.find(d => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return d.date === `${today.getFullYear()}-${mm}-${dd}`;
  })?.costUsd ?? 0;

  const totalCost = usageSummary?.totalCostUsd ?? 0;
  const dailyLimit = budgetConfig?.dailyLimitUsd ?? null;

  // Session breakdown
  const sessions = usageSummary?.bySession ?? [];
  const maxSessionCost = sessions.reduce((m, s) => Math.max(m, s.costUsd), 0);

  // Daily trend (last 7 days from summary)
  const days = usageSummary?.byDay.slice(-7) ?? [];
  const maxDayCost = days.reduce((m, d) => Math.max(m, d.costUsd), 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Usage & Costs</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {usageSummary === null ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No usage data</Text>
          <Text style={styles.emptySubtitle}>Usage will appear here once sessions are active.</Text>
          <TouchableOpacity style={styles.refreshButtonLarge} onPress={onRefresh}>
            <Text style={styles.refreshButtonLargeText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Top summary cards */}
          <View style={styles.summaryRow}>
            <SummaryCard label="Today" value={formatCost(todayCost)} />
            <SummaryCard label="This Period" value={formatCost(totalCost)} />
            <SummaryCard label="Tokens" value={formatTokens(usageSummary.totalTokens)} />
          </View>

          {/* Budget gauge */}
          <BudgetGauge
            used={todayCost}
            limit={dailyLimit}
            budgetInput={budgetInput}
            onBudgetInputChange={setBudgetInput}
            onSetBudget={handleSetBudget}
          />

          {/* Session breakdown */}
          <Text style={styles.sectionTitle}>Sessions</Text>
          {sessions.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptySectionText}>No session data</Text>
            </View>
          ) : (
            <View style={styles.card}>
              {sessions.map(s => (
                <SessionRow
                  key={s.sessionId}
                  sessionName={s.sessionName}
                  costUsd={s.costUsd}
                  tokens={s.tokens}
                  maxCost={maxSessionCost}
                />
              ))}
            </View>
          )}

          {/* Daily trend */}
          <Text style={styles.sectionTitle}>Daily Trend</Text>
          {days.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptySectionText}>No daily data</Text>
            </View>
          ) : (
            <View style={styles.card}>
              {days.map(d => (
                <DayRow
                  key={d.date}
                  date={d.date}
                  costUsd={d.costUsd}
                  tokens={d.tokens}
                  maxCost={maxDayCost}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backButton: { padding: 8 },
  backText: { color: '#3b82f6', fontSize: 20 },
  headerTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '600' },
  refreshButton: { padding: 8 },
  refreshText: { color: '#3b82f6', fontSize: 14 },

  // Scroll
  scrollContent: { padding: 16, paddingBottom: 40 },

  // Summary row
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  summaryCardValue: { color: '#f8fafc', fontSize: 18, fontWeight: '700' },
  summaryCardLabel: { color: '#64748b', fontSize: 11, marginTop: 4 },

  // Gauge card
  gaugeCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  gaugeTrack: {
    height: 12,
    backgroundColor: '#334155',
    borderRadius: 6,
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 6,
  },
  gaugeFill: {
    height: '100%',
    borderRadius: 6,
    minWidth: 4,
  },
  gaugeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  gaugeUsed: { fontSize: 15, fontWeight: '600' },
  gaugeLimit: { color: '#64748b', fontSize: 13 },
  gaugePct: { fontSize: 13, fontWeight: '600' },
  noBudgetText: { color: '#64748b', fontSize: 13, marginTop: 8, marginBottom: 12 },
  budgetInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  budgetInput: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  budgetSetButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  budgetSetButtonText: { color: '#f8fafc', fontSize: 14, fontWeight: '600' },

  // Section title
  sectionTitle: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },

  // Generic card
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 12,
  },

  // Session rows
  sessionRow: { gap: 6 },
  sessionRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionName: { color: '#f8fafc', fontSize: 13, flex: 1, marginRight: 8 },
  sessionRowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sessionCost: { fontSize: 13, fontWeight: '600' },
  sessionTokens: { color: '#64748b', fontSize: 11 },
  sessionBarTrack: {
    height: 4,
    backgroundColor: '#334155',
    borderRadius: 2,
    overflow: 'hidden',
  },
  sessionBarFill: { height: '100%', borderRadius: 2, minWidth: 4 },

  // Day rows
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dayLabel: { color: '#94a3b8', fontSize: 12, width: 40 },
  dayBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#334155',
    borderRadius: 4,
    overflow: 'hidden',
  },
  dayBarFill: { height: '100%', borderRadius: 4, minWidth: 4 },
  dayCost: { fontSize: 12, fontWeight: '600', width: 48, textAlign: 'right' },

  // Empty states
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptySubtitle: { color: '#64748b', fontSize: 14, textAlign: 'center', marginBottom: 24 },
  refreshButtonLarge: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  refreshButtonLargeText: { color: '#f8fafc', fontSize: 15, fontWeight: '600' },
  emptySection: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  emptySectionText: { color: '#64748b', fontSize: 14 },
});
