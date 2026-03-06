/**
 * TerminalScreen — Real-time terminal view synced from PC.
 *
 * Displays the terminal output from a doubltmux session in real-time.
 * Users can:
 * - View live terminal output (synced from PC)
 * - Send commands from mobile (synced back to PC)
 * - See running command status
 *
 * This enables scenario 2: when `ls` or `claude` runs on PC,
 * the output is visible on mobile in real-time.
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SessionListItem, LongRunningCommand } from '@doublt/shared';
import { stripAnsi } from '../utils/stripAnsi';

interface Props {
  sessionInfo: SessionListItem | null;
  terminalOutput: string;
  runningCommands: LongRunningCommand[];
  onSendInput: (data: string) => void;
  onBack: () => void;
}

export function TerminalScreen({
  sessionInfo,
  terminalOutput,
  runningCommands,
  onSendInput,
  onBack,
}: Props) {
  const insets = useSafeAreaInsets();
  const cleanOutput = useMemo(() => stripAnsi(terminalOutput), [terminalOutput]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Auto-scroll to bottom on new output
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 50);
  }, [terminalOutput]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSendInput(trimmed + '\n');
    setInput('');
  };

  const sessionCommands = runningCommands.filter(
    cmd => cmd.sessionId === sessionInfo?.id
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>{'<'}</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>
            Terminal: {sessionInfo?.name ?? 'Session'}
          </Text>
          {sessionCommands.length > 0 && (
            <Text style={styles.runningLabel}>
              {sessionCommands.length} command(s) running
            </Text>
          )}
        </View>
      </View>

      {/* Running commands bar */}
      {sessionCommands.length > 0 && (
        <View style={styles.commandBar}>
          {sessionCommands.map(cmd => (
            <View key={cmd.id} style={styles.commandItem}>
              <View style={styles.commandDot} />
              <Text style={styles.commandText} numberOfLines={1}>
                {cmd.command}
              </Text>
              <Text style={styles.commandElapsed}>
                {formatElapsed(Date.now() - cmd.startedAt)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Terminal output */}
      <ScrollView
        ref={scrollRef}
        style={styles.terminal}
        contentContainerStyle={styles.terminalContent}
      >
        <Text style={styles.terminalText} selectable>
          {cleanOutput || 'Waiting for terminal output...'}
        </Text>
      </ScrollView>

      {/* Input */}
      <View style={styles.inputContainer}>
        <Text style={styles.prompt}>$</Text>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Enter command..."
          placeholderTextColor="#64748b"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[styles.sendButton, !input.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!input.trim()}
        >
          <Text style={styles.sendButtonText}>Run</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backButton: { padding: 8, marginRight: 8 },
  backText: { color: '#3b82f6', fontSize: 20 },
  headerInfo: { flex: 1 },
  headerTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '600', fontFamily: 'monospace' },
  runningLabel: { color: '#22c55e', fontSize: 11, marginTop: 2 },
  commandBar: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  commandItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  commandDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
    marginRight: 8,
  },
  commandText: {
    color: '#f8fafc',
    fontSize: 12,
    fontFamily: 'monospace',
    flex: 1,
  },
  commandElapsed: {
    color: '#64748b',
    fontSize: 11,
    fontFamily: 'monospace',
    marginLeft: 8,
  },
  terminal: {
    flex: 1,
    backgroundColor: '#000',
  },
  terminalContent: {
    padding: 12,
    paddingBottom: 24,
  },
  terminalText: {
    color: '#22c55e',
    fontSize: 13,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    alignItems: 'center',
  },
  prompt: {
    color: '#22c55e',
    fontSize: 16,
    fontFamily: 'monospace',
    marginRight: 8,
    fontWeight: 'bold',
  },
  input: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#f8fafc',
    fontSize: 14,
    fontFamily: 'monospace',
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: '#22c55e',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sendButtonDisabled: { opacity: 0.4 },
  sendButtonText: { color: '#000', fontWeight: '600', fontSize: 14 },
});
