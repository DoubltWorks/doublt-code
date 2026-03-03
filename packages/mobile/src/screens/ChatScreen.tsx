/**
 * ChatScreen — Mobile chat interface for a doublt session.
 *
 * This is the main interaction screen where mobile users can:
 * - View the conversation (same messages the PC CLI sees)
 * - Send messages (which appear on both PC and mobile)
 * - Approve/deny tool uses
 * - See context usage and trigger handoff
 *
 * Key difference from Happy Coder: messages sent here appear
 * immediately on the PC without any mode switching.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import type { ChatMessage, ToolUseMessage, SessionListItem, CommandMacro } from '@doublt/shared';
import { CostBadge } from '../components/CostBadge';
import { QuickActionBar } from '../components/QuickActionBar';
import { VoiceInputButton } from '../components/VoiceInputButton';

interface Props {
  sessionInfo: SessionListItem | null;
  messages: ChatMessage[];
  pendingApprovals: ToolUseMessage[];
  onSendMessage: (content: string) => void;
  onApproveTool: (toolUseId: string, approved: boolean) => void;
  onHandoff: () => void;
  onBack: () => void;
  costUsd?: number;
  macros?: CommandMacro[];
  onOpenApprovals?: () => void;
  onOpenTasks?: () => void;
  onOpenDigest?: () => void;
  onOpenUsage?: () => void;
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const isFromMobile = message.sourceClient?.type === 'mobile';
  const isFromCli = message.sourceClient?.type === 'cli';

  return (
    <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
      {message.sourceClient && (
        <Text style={styles.sourceLabel}>
          {isFromMobile ? 'mobile' : isFromCli ? 'pc' : message.sourceClient.type}
        </Text>
      )}
      <Text style={[styles.messageText, isUser ? styles.userText : styles.assistantText]}>
        {message.content}
      </Text>
      {message.partial && <Text style={styles.partialIndicator}>...</Text>}
    </View>
  );
}

function ToolApprovalCard({
  tool,
  onApprove,
  onDeny,
}: {
  tool: ToolUseMessage;
  onApprove: () => void;
  onDeny: () => void;
}) {
  return (
    <View style={styles.approvalCard}>
      <Text style={styles.approvalTitle}>Tool approval needed</Text>
      <Text style={styles.toolName}>{tool.toolName}</Text>
      <Text style={styles.toolInput}>{JSON.stringify(tool.input, null, 2)}</Text>
      <View style={styles.approvalButtons}>
        <TouchableOpacity style={styles.denyButton} onPress={onDeny}>
          <Text style={styles.denyButtonText}>Deny</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.approveButton} onPress={onApprove}>
          <Text style={styles.approveButtonText}>Approve</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function ChatScreen({
  sessionInfo,
  messages,
  pendingApprovals,
  onSendMessage,
  onApproveTool,
  onHandoff,
  onBack,
  costUsd = 0,
  macros = [],
  onOpenApprovals,
  onOpenTasks,
  onOpenDigest,
  onOpenUsage,
}: Props) {
  const [input, setInput] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    // Auto-scroll to bottom on new messages
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setInput('');
  };

  const contextPct = sessionInfo ? Math.round(sessionInfo.contextUsage * 100) : 0;
  const contextColor = contextPct >= 85 ? '#ef4444' : contextPct >= 60 ? '#f59e0b' : '#22c55e';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>{'<'}</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{sessionInfo?.name ?? 'Session'}</Text>
          <View style={styles.headerMeta}>
            <Text style={[styles.contextLabel, { color: contextColor }]}>
              ctx: {contextPct}%
            </Text>
            {costUsd > 0 && <CostBadge costUsd={costUsd} />}
            {(sessionInfo?.clientCount ?? 0) > 1 && (
              <Text style={styles.multiDevice}>{sessionInfo!.clientCount} devices</Text>
            )}
          </View>
        </View>
        {contextPct >= 85 && (
          <TouchableOpacity style={styles.handoffButton} onPress={onHandoff}>
            <Text style={styles.handoffText}>Handoff</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Pending approvals */}
      {pendingApprovals.map(tool => (
        <ToolApprovalCard
          key={tool.id}
          tool={tool}
          onApprove={() => onApproveTool(tool.id, true)}
          onDeny={() => onApproveTool(tool.id, false)}
        />
      ))}

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MessageBubble message={item} />}
        contentContainerStyle={styles.messageList}
        style={styles.messageListContainer}
      />

      {/* Quick Actions */}
      <QuickActionBar
        actions={[]}
        macros={macros}
        onAction={(action) => {
          if (action.action === 'chat_send' && action.payload) {
            onSendMessage(action.payload);
          } else if (action.action === 'trigger_handoff') {
            onHandoff();
          } else if (action.action === 'approve_all' && onOpenApprovals) {
            onOpenApprovals();
          }
        }}
        onMacro={(macro) => onSendMessage(macro.command)}
      />

      {/* Input */}
      <View style={styles.inputContainer}>
        <VoiceInputButton onVoiceResult={(text) => setInput(prev => prev + text)} size={36} />
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Send a message..."
          placeholderTextColor="#64748b"
          multiline
          maxLength={10000}
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[styles.sendButton, !input.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!input.trim()}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
  headerInfo: { flex: 1 },
  headerTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '600' },
  headerMeta: { flexDirection: 'row', marginTop: 2 },
  contextLabel: { fontSize: 12, fontFamily: 'monospace', marginRight: 12 },
  multiDevice: { color: '#3b82f6', fontSize: 12 },
  handoffButton: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  handoffText: { color: '#000', fontWeight: '600', fontSize: 12 },
  messageListContainer: { flex: 1 },
  messageList: { padding: 16 },
  messageBubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#3b82f6' },
  assistantBubble: { alignSelf: 'flex-start', backgroundColor: '#1e293b' },
  sourceLabel: { color: '#94a3b8', fontSize: 10, marginBottom: 4, textTransform: 'uppercase' },
  messageText: { fontSize: 15, lineHeight: 22 },
  userText: { color: '#fff' },
  assistantText: { color: '#e2e8f0' },
  partialIndicator: { color: '#64748b', marginTop: 4 },
  approvalCard: {
    margin: 16,
    padding: 16,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  approvalTitle: { color: '#f59e0b', fontWeight: '600', fontSize: 14, marginBottom: 8 },
  toolName: { color: '#f8fafc', fontSize: 16, fontFamily: 'monospace', marginBottom: 8 },
  toolInput: {
    color: '#94a3b8',
    fontSize: 12,
    fontFamily: 'monospace',
    backgroundColor: '#0f172a',
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
  },
  approvalButtons: { flexDirection: 'row', justifyContent: 'flex-end' },
  denyButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ef4444',
    marginRight: 8,
  },
  denyButtonText: { color: '#ef4444', fontWeight: '600' },
  approveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#22c55e',
  },
  approveButtonText: { color: '#fff', fontWeight: '600' },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 15,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendButtonDisabled: { opacity: 0.4 },
  sendButtonText: { color: '#fff', fontWeight: '600' },
});
