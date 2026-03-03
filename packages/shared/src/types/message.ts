/**
 * Message types for the doublt-code protocol.
 *
 * Messages flow bidirectionally between all connected clients (PC + mobile)
 * and the server. Unlike Happy Coder's separated remote/local modes,
 * all clients participate in the same unified message stream.
 */

import type { SessionId, ClientId, ClientType } from './session.js';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  sessionId: SessionId;
  role: MessageRole;
  content: string;
  timestamp: number;
  /** Which client sent this message (undefined for assistant/system) */
  sourceClient?: {
    id: ClientId;
    type: ClientType;
  };
  /** Streaming: is this a partial message still being generated? */
  partial?: boolean;
}

export interface ToolUseMessage {
  id: string;
  sessionId: SessionId;
  toolName: string;
  input: Record<string, unknown>;
  output?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  timestamp: number;
}

/** Notification that appears on mobile when session needs attention */
export interface SessionNotification {
  sessionId: SessionId;
  type: 'context_high' | 'handoff_ready' | 'error' | 'approval_needed' | 'completed';
  title: string;
  body: string;
  timestamp: number;
}
