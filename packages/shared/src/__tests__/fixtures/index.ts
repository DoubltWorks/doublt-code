import type {
  Session,
  ConnectedClient,
  ChatMessage,
  TokenUsage,
  Task,
  ActivityEvent,
  ApprovalRule,
  SearchQuery,
} from '../../index.js';
import type { HandoffData } from '../../utils/handoff.js';

let counter = 0;
function nextId(): string {
  return `test-${++counter}`;
}

export function resetCounter(): void {
  counter = 0;
}

export function makeSession(overrides: Partial<Session> = {}): Session {
  const id = nextId();
  return {
    id,
    name: `session-${id}`,
    status: 'active',
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    cwd: '/tmp/test',
    clients: [],
    contextUsage: 0,
    ...overrides,
  };
}

export function makeClient(overrides: Partial<ConnectedClient> = {}): ConnectedClient {
  return {
    id: nextId(),
    type: 'cli',
    connectedAt: Date.now(),
    lastSeenAt: Date.now(),
    deviceInfo: 'test-device',
    ...overrides,
  };
}

export function makeChatMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: nextId(),
    sessionId: 'sess-1',
    role: 'user',
    content: 'Hello, world!',
    timestamp: Date.now(),
    ...overrides,
  };
}

export function makeTokenUsage(overrides: Partial<TokenUsage> = {}): TokenUsage {
  return {
    inputTokens: 1000,
    outputTokens: 500,
    totalTokens: 1500,
    model: 'claude-3-sonnet',
    timestamp: Date.now(),
    ...overrides,
  };
}

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: nextId(),
    title: 'Test task',
    description: 'A test task',
    priority: 'normal',
    status: 'queued',
    createdAt: Date.now(),
    ...overrides,
  };
}

export function makeActivityEvent(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id: nextId(),
    type: 'message',
    sessionId: 'sess-1',
    timestamp: Date.now(),
    summary: 'Test event',
    ...overrides,
  };
}

export function makeApprovalRule(overrides: Partial<Omit<ApprovalRule, 'id'>> = {}): Omit<ApprovalRule, 'id'> {
  return {
    toolPattern: '*',
    action: 'require_confirm',
    ...overrides,
  };
}

export function makeSearchQuery(overrides: Partial<SearchQuery> = {}): SearchQuery {
  return {
    query: 'test',
    scope: 'all',
    ...overrides,
  };
}

export function makeHandoffData(overrides: Partial<HandoffData> = {}): HandoffData {
  return {
    parentSessionId: 'parent-1',
    timestamp: Date.now(),
    summary: 'Working on feature X',
    currentTasks: ['Implement API endpoint', 'Write tests'],
    decisions: ['Use REST over GraphQL', 'PostgreSQL for storage'],
    relevantFiles: ['src/api.ts', 'src/db.ts'],
    blockers: [],
    additionalContext: 'Need to finish by Friday',
    ...overrides,
  };
}
