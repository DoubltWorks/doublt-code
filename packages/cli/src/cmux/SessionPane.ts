/**
 * SessionPane — A single session pane in the cmux layout.
 *
 * Like tmux panes, each SessionPane represents a terminal view
 * connected to one session. Unlike tmux, panes can receive input
 * from both the local terminal AND a connected mobile device.
 *
 * Key differences from tmux:
 * - Panes are tied to doublt sessions, not shell processes
 * - Input can come from multiple sources simultaneously
 * - Status bar shows mobile connection state
 * - Context usage indicator for AI sessions
 */

import { EventEmitter } from 'node:events';
import type { SessionId, SessionListItem, ChatMessage } from '@doublt/shared';

export type PaneId = string;

export interface PaneLayout {
  id: PaneId;
  sessionId: SessionId;
  /** Position in the split layout */
  row: number;
  col: number;
  /** Size as percentage of parent */
  widthPercent: number;
  heightPercent: number;
  /** Is this the currently focused pane? */
  focused: boolean;
}

export class SessionPane extends EventEmitter {
  readonly id: PaneId;
  readonly sessionId: SessionId;

  private messages: ChatMessage[] = [];
  private sessionInfo: SessionListItem | null = null;
  private scrollOffset = 0;
  private _focused = false;

  constructor(sessionId: SessionId, paneId?: PaneId) {
    super();
    this.sessionId = sessionId;
    this.id = paneId ?? `pane-${Date.now()}`;
  }

  get focused(): boolean {
    return this._focused;
  }

  set focused(value: boolean) {
    this._focused = value;
    this.emit('focus:changed', value);
  }

  addMessage(msg: ChatMessage): void {
    // Handle streaming: update existing partial message or add new one
    const existing = this.messages.find(m => m.id === msg.id);
    if (existing) {
      existing.content = msg.content;
      existing.partial = msg.partial;
    } else {
      this.messages.push(msg);
    }
    this.emit('message:added', msg);
  }

  updateSessionInfo(info: SessionListItem): void {
    this.sessionInfo = info;
    this.emit('session:updated', info);
  }

  getMessages(): ChatMessage[] {
    return this.messages;
  }

  getSessionInfo(): SessionListItem | null {
    return this.sessionInfo;
  }

  getStatusLine(): string {
    if (!this.sessionInfo) return `[${this.id}] connecting...`;

    const info = this.sessionInfo;
    const contextBar = this.renderContextBar(info.contextUsage);
    const clientIcon = info.clientCount > 1 ? `[${info.clientCount} clients]` : '';
    const statusIcon = info.status === 'active' ? '*' : info.status === 'handoff_pending' ? '!' : '-';

    return `${statusIcon} ${info.index}:${info.name} ${contextBar} ${clientIcon}`;
  }

  private renderContextBar(usage: number): string {
    const width = 10;
    const filled = Math.round(usage * width);
    const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
    const pct = Math.round(usage * 100);

    if (usage >= 0.85) return `[${bar}] ${pct}% ⚠`;
    return `[${bar}] ${pct}%`;
  }

  scrollUp(lines: number = 1): void {
    this.scrollOffset = Math.min(this.scrollOffset + lines, Math.max(0, this.messages.length - 1));
  }

  scrollDown(lines: number = 1): void {
    this.scrollOffset = Math.max(0, this.scrollOffset - lines);
  }

  getScrollOffset(): number {
    return this.scrollOffset;
  }
}
