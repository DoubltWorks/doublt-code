import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import type { GitStatus, GitCommit } from '@doublt/shared';

interface Props {
  gitStatus: GitStatus | null;
  gitLog: GitCommit[];
  onRefresh: () => void;
  onViewDiff: () => void;
  onBack: () => void;
}

function FileItem({ path, status }: { path: string; status: string }) {
  const statusColors: Record<string, string> = {
    modified: '#f59e0b',
    added: '#22c55e',
    deleted: '#ef4444',
    renamed: '#3b82f6',
    untracked: '#94a3b8',
  };

  const statusLabels: Record<string, string> = {
    modified: 'M',
    added: 'A',
    deleted: 'D',
    renamed: 'R',
    untracked: '?',
  };

  return (
    <View style={styles.fileItem}>
      <Text style={[styles.fileStatus, { color: statusColors[status] ?? '#94a3b8' }]}>
        {statusLabels[status] ?? '?'}
      </Text>
      <Text style={styles.filePath} numberOfLines={1}>{path}</Text>
    </View>
  );
}

function CommitItem({ commit }: { commit: GitCommit }) {
  const date = new Date(commit.date);
  const timeStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;

  return (
    <View style={styles.commitItem}>
      <View style={styles.commitHeader}>
        <Text style={styles.commitHash}>{commit.shortHash}</Text>
        <Text style={styles.commitDate}>{timeStr}</Text>
      </View>
      <Text style={styles.commitMessage} numberOfLines={2}>{commit.message}</Text>
      <Text style={styles.commitAuthor}>{commit.author}</Text>
    </View>
  );
}

export function GitStatusScreen({ gitStatus, gitLog, onRefresh, onViewDiff, onBack }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Git Status</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={onViewDiff} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>Diff</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onRefresh} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={[{ key: 'content' }]}
        renderItem={() => (
          <View>
            {gitStatus ? (
              <>
                <View style={styles.branchBar}>
                  <Text style={styles.branchName}>{gitStatus.branch}</Text>
                  <View style={styles.aheadBehind}>
                    {gitStatus.ahead > 0 && (
                      <Text style={styles.aheadText}>+{gitStatus.ahead}</Text>
                    )}
                    {gitStatus.behind > 0 && (
                      <Text style={styles.behindText}>-{gitStatus.behind}</Text>
                    )}
                  </View>
                </View>

                {gitStatus.hasConflicts && (
                  <View style={styles.conflictBanner}>
                    <Text style={styles.conflictText}>Merge conflicts detected</Text>
                  </View>
                )}

                {gitStatus.staged.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                      Staged ({gitStatus.staged.length})
                    </Text>
                    {gitStatus.staged.map((file, i) => (
                      <FileItem key={`staged-${i}`} path={file.path} status={file.status} />
                    ))}
                  </View>
                )}

                {gitStatus.unstaged.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                      Unstaged ({gitStatus.unstaged.length})
                    </Text>
                    {gitStatus.unstaged.map((file, i) => (
                      <FileItem key={`unstaged-${i}`} path={file.path} status={file.status} />
                    ))}
                  </View>
                )}

                {gitStatus.untracked.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                      Untracked ({gitStatus.untracked.length})
                    </Text>
                    {gitStatus.untracked.map((file, i) => (
                      <FileItem key={`untracked-${i}`} path={file} status="untracked" />
                    ))}
                  </View>
                )}

                {gitStatus.staged.length === 0 &&
                  gitStatus.unstaged.length === 0 &&
                  gitStatus.untracked.length === 0 && (
                    <Text style={styles.cleanText}>Working tree clean</Text>
                  )}
              </>
            ) : (
              <Text style={styles.loadingText}>Loading git status...</Text>
            )}

            {gitLog.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recent Commits</Text>
                {gitLog.map((commit) => (
                  <CommitItem key={commit.hash} commit={commit} />
                ))}
              </View>
            )}
          </View>
        )}
        contentContainerStyle={styles.content}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backButton: { padding: 8, marginRight: 8 },
  backText: { color: '#3b82f6', fontSize: 20 },
  title: { flex: 1, fontSize: 20, fontWeight: 'bold', color: '#f8fafc' },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerButton: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  headerButtonText: { color: '#3b82f6', fontSize: 13, fontWeight: '600' },
  content: { padding: 16 },
  branchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  branchName: {
    color: '#3b82f6',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  aheadBehind: { flexDirection: 'row', gap: 8 },
  aheadText: { color: '#22c55e', fontSize: 13, fontFamily: 'monospace' },
  behindText: { color: '#ef4444', fontSize: 13, fontFamily: 'monospace' },
  conflictBanner: {
    backgroundColor: '#7f1d1d',
    padding: 10,
    borderRadius: 6,
    marginBottom: 16,
  },
  conflictText: { color: '#fca5a5', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  section: { marginBottom: 20 },
  sectionTitle: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  fileStatus: {
    fontSize: 13,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    width: 20,
  },
  filePath: {
    color: '#e2e8f0',
    fontSize: 13,
    fontFamily: 'monospace',
    flex: 1,
  },
  cleanText: {
    color: '#22c55e',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 40,
  },
  commitItem: {
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  commitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  commitHash: {
    color: '#f59e0b',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  commitDate: {
    color: '#64748b',
    fontSize: 11,
  },
  commitMessage: {
    color: '#f8fafc',
    fontSize: 13,
    marginBottom: 4,
  },
  commitAuthor: {
    color: '#64748b',
    fontSize: 11,
  },
});
