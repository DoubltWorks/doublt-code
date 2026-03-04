/**
 * DigestManager — Tracks activity events and generates catch-up digests.
 *
 * Stores up to 10,000 events (newest first) and supports:
 * - Logging events from any session
 * - Generating digest summaries for a time window
 * - Paginated timeline queries
 * - Cursor-based history for mobile catch-up
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import type {
  ActivityEvent,
  ActivityEventType,
  DigestSummary,
  HistoryPage,
  TimelineEntry,
} from '@doublt/shared';

const MAX_EVENTS = 10_000;

export class DigestManager extends EventEmitter {
  private events: ActivityEvent[] = [];

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Log an activity event. Emits 'event:logged'.
   * Caps storage at MAX_EVENTS by dropping the oldest entries.
   */
  logEvent(
    type: ActivityEventType,
    sessionId: string,
    summary: string,
    data?: Record<string, unknown>
  ): ActivityEvent {
    const event: ActivityEvent = {
      id: crypto.randomUUID().slice(0, 8),
      type,
      sessionId,
      timestamp: Date.now(),
      summary,
      data,
    };

    // Newest first
    this.events.unshift(event);

    // Enforce cap
    if (this.events.length > MAX_EVENTS) {
      this.events.length = MAX_EVENTS;
    }

    this.emit('event:logged', event);
    return event;
  }

  /**
   * Generate a digest summary for all events since the given timestamp.
   * Emits 'digest:generated'.
   */
  generateDigest(since: number): DigestSummary {
    const until = Date.now();
    const window = this.events.filter(e => e.timestamp >= since && e.timestamp <= until);

    let messagesCount = 0;
    let toolUseCount = 0;
    let errorsCount = 0;
    let commandsRun = 0;
    const sessionIds = new Set<string>();

    for (const e of window) {
      sessionIds.add(e.sessionId);
      switch (e.type) {
        case 'message': messagesCount++; break;
        case 'tool_use': toolUseCount++; break;
        case 'error': errorsCount++; break;
        case 'command': commandsRun++; break;
        default: break;
      }
    }

    // Key events: errors first, then handoffs, then commands, up to 5
    const errors   = window.filter(e => e.type === 'error');
    const handoffs = window.filter(e => e.type === 'handoff');
    const commands = window.filter(e => e.type === 'command');
    const keyEvents = [...errors, ...handoffs, ...commands].slice(0, 5);

    const sessionsActive = sessionIds.size;
    const summaryText =
      `${messagesCount} messages across ${sessionsActive} session${sessionsActive !== 1 ? 's' : ''}. ` +
      `${toolUseCount} tool use${toolUseCount !== 1 ? 's' : ''}. ` +
      `${errorsCount} error${errorsCount !== 1 ? 's' : ''}.`;

    const digest: DigestSummary = {
      period: { since, until },
      sessionsActive,
      messagesCount,
      toolUseCount,
      errorsCount,
      commandsRun,
      keyEvents,
      summary: summaryText,
    };

    this.emit('digest:generated', digest);
    return digest;
  }

  /**
   * Return timeline entries, optionally filtered by sessionId.
   */
  getTimeline(
    sessionId?: string,
    options: { limit?: number; offset?: number } = {}
  ): TimelineEntry[] {
    const { limit = 50, offset = 0 } = options;

    let source = sessionId
      ? this.events.filter(e => e.sessionId === sessionId)
      : [...this.events];

    return source.slice(offset, offset + limit).map(eventToTimeline);
  }

  /**
   * Cursor-based history page for mobile catch-up.
   * Cursor encodes an index into the events array (as a base-10 string).
   */
  getHistory(sessionId: string, cursor?: string, limit = 20): HistoryPage {
    const filtered = this.events.filter(e => e.sessionId === sessionId);
    const offset = cursor ? parseInt(cursor, 10) : 0;
    const slice = filtered.slice(offset, offset + limit);
    const hasMore = offset + limit < filtered.length;

    return {
      messages: slice.map(eventToTimeline),
      hasMore,
      nextCursor: hasMore ? String(offset + limit) : undefined,
    };
  }

  /**
   * Return the most recent N events (default 10), unfiltered.
   */
  getRecentEvents(count = 10): ActivityEvent[] {
    return this.events.slice(0, count);
  }

  /**
   * Delete all events older than the given timestamp.
   * Returns the number of deleted entries.
   */
  clearOldEvents(beforeTimestamp: number): number {
    const before = this.events.length;
    this.events = this.events.filter(e => e.timestamp >= beforeTimestamp);
    return before - this.events.length;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function eventToTimeline(event: ActivityEvent): TimelineEntry {
  return {
    timestamp: event.timestamp,
    type: event.type,
    title: titleFor(event),
    detail: event.summary,
    sessionId: event.sessionId,
  };
}

function titleFor(event: ActivityEvent): string {
  switch (event.type) {
    case 'message':  return 'Message';
    case 'tool_use': return 'Tool Use';
    case 'error':    return 'Error';
    case 'handoff':  return 'Handoff';
    case 'command':  return 'Command';
    case 'commit':   return 'Commit';
    default:         return 'Event';
  }
}
