export type ActivityEventType = 'message' | 'tool_use' | 'error' | 'handoff' | 'command' | 'commit';

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  sessionId: string;
  timestamp: number;
  summary: string;
  data?: Record<string, unknown>;
}

export interface DigestSummary {
  period: { since: number; until: number };
  sessionsActive: number;
  messagesCount: number;
  toolUseCount: number;
  errorsCount: number;
  commandsRun: number;
  keyEvents: ActivityEvent[];
  summary: string;
}

export interface TimelineEntry {
  timestamp: number;
  type: ActivityEventType;
  title: string;
  detail: string;
  sessionId: string;
}

export interface HistoryPage {
  messages: TimelineEntry[];
  hasMore: boolean;
  nextCursor?: string;
}
