import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SearchResult, SearchResultType } from '@doublt/shared/src/types/search.js';
import { SearchBar } from '../components/SearchBar.js';

interface Props {
  searchResults: SearchResult[];
  onSearch: (query: string) => void;
  onSelectResult: (result: SearchResult) => void;
  onBack: () => void;
}

type FilterType = 'all' | SearchResultType;

const TYPE_ICONS: Record<SearchResultType, string> = {
  message: '💬',
  session: '🪟',
  workspace: '📁',
};

const FILTERS: { label: string; value: FilterType }[] = [
  { label: 'All', value: 'all' },
  { label: 'Messages', value: 'message' },
  { label: 'Sessions', value: 'session' },
  { label: 'Workspaces', value: 'workspace' },
];

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const now = Date.now();
  const diffMs = now - ts;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return d.toLocaleDateString();
}

function ScoreBar({ score }: { score: number }) {
  const dots = Math.round(score * 5);
  return (
    <View style={styles.scoreRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={[styles.scoreDot, i <= dots ? styles.scoreDotActive : styles.scoreDotInactive]} />
      ))}
    </View>
  );
}

export function SearchScreen({ searchResults, onSearch, onSelectResult, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleQueryChange = useCallback(
    (text: string) => {
      setQuery(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onSearch(text);
      }, 300);
    },
    [onSearch],
  );

  const filtered =
    activeFilter === 'all' ? searchResults : searchResults.filter((r) => r.type === activeFilter);

  const renderResult = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity style={styles.resultCard} onPress={() => onSelectResult(item)} activeOpacity={0.7}>
      <View style={styles.resultRow}>
        <Text style={styles.typeIcon}>{TYPE_ICONS[item.type]}</Text>
        <View style={styles.resultContent}>
          <Text style={styles.resultTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.resultSnippet} numberOfLines={2}>
            {item.snippet}
          </Text>
          <View style={styles.resultMeta}>
            <ScoreBar score={item.matchScore} />
            <Text style={styles.resultTime}>{formatTimestamp(item.timestamp)}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const listEmpty = () => {
    if (query.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>{'🔍'}</Text>
          <Text style={styles.emptyText}>Search across all your sessions</Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>{'😶'}</Text>
        <Text style={styles.emptyText}>No results found for &apos;{query}&apos;</Text>
      </View>
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>{'< Back'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Search</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.searchContainer}>
        <SearchBar value={query} onChangeText={handleQueryChange} placeholder="Search messages, sessions..." autoFocus />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersRow}
        contentContainerStyle={styles.filtersContent}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filterBtn, activeFilter === f.value && styles.filterBtnActive]}
            onPress={() => setActiveFilter(f.value)}
          >
            <Text style={[styles.filterBtnText, activeFilter === f.value && styles.filterBtnTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        renderItem={renderResult}
        ListEmptyComponent={listEmpty}
        contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backButton: {
    padding: 4,
    minWidth: 60,
  },
  backButtonText: {
    color: '#3b82f6',
    fontSize: 15,
  },
  title: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '600',
  },
  headerSpacer: {
    minWidth: 60,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  filtersRow: {
    flexShrink: 0,
  },
  filtersContent: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#1e293b',
  },
  filterBtnActive: {
    backgroundColor: '#3b82f6',
  },
  filterBtnText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '500',
  },
  filterBtnTextActive: {
    color: '#f8fafc',
  },
  listContent: {
    padding: 16,
    gap: 10,
  },
  emptyContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 60,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  resultCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  typeIcon: {
    fontSize: 20,
    marginRight: 12,
    marginTop: 2,
  },
  resultContent: {
    flex: 1,
    gap: 4,
  },
  resultTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '600',
  },
  resultSnippet: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
  },
  resultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  scoreRow: {
    flexDirection: 'row',
    gap: 3,
  },
  scoreDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  scoreDotActive: {
    backgroundColor: '#3b82f6',
  },
  scoreDotInactive: {
    backgroundColor: '#334155',
  },
  resultTime: {
    color: '#475569',
    fontSize: 11,
  },
});
