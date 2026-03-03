/**
 * HandoffManager — Automatic context handoff between sessions.
 *
 * When a session's context usage approaches the limit, HandoffManager:
 * 1. Generates a HANDOFF.md summarizing the session state
 * 2. Creates a new session seeded with that context
 * 3. Migrates all connected clients to the new session
 *
 * This is inspired by Happy Coder's auto-session-handoff but enhanced:
 * - Uses structured HANDOFF.md format (not just raw text)
 * - Integrates with Claude Code's auto-memory (CLAUDE.md)
 * - Preserves todo state across sessions
 */

import { EventEmitter } from 'node:events';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { SessionId, Session } from '@doublt/shared';
import { generateHandoffMd, type HandoffData } from '@doublt/shared';
import type { SessionManager } from '../session/SessionManager.js';

export interface HandoffResult {
  parentSessionId: SessionId;
  newSessionId: SessionId;
  handoffFilePath: string;
  summary: string;
}

export class HandoffManager extends EventEmitter {
  private handoffDir: string;

  constructor(
    private sessionManager: SessionManager,
    baseDir: string = process.cwd()
  ) {
    super();
    this.handoffDir = join(baseDir, '.doublt', 'handoffs');

    // Listen for context threshold events
    this.sessionManager.on('session:handoff_needed', (session: Session) => {
      this.prepareHandoff(session.id).catch(err => {
        this.emit('handoff:error', { sessionId: session.id, error: err });
      });
    });
  }

  /**
   * Prepare a handoff from the given session.
   * Generates HANDOFF.md and creates a new session ready to continue.
   */
  async prepareHandoff(sessionId: SessionId): Promise<HandoffResult | null> {
    const session = this.sessionManager.get(sessionId);
    if (!session) return null;

    // Build handoff data from session state
    const handoffData: HandoffData = {
      parentSessionId: sessionId,
      timestamp: Date.now(),
      summary: `Continuation of session "${session.name}" — context limit approaching.`,
      currentTasks: [], // populated by the AI or extracted from conversation
      decisions: [],
      relevantFiles: [],
      blockers: [],
      additionalContext: session.handoffContext ?? '',
    };

    // Emit event to let higher-level systems enrich the handoff data
    // (e.g., the Claude Code bridge can ask the AI to summarize)
    this.emit('handoff:preparing', { sessionId, handoffData });

    const handoffContent = generateHandoffMd(handoffData);

    // Persist to disk
    await mkdir(this.handoffDir, { recursive: true });
    const handoffFile = join(this.handoffDir, `${sessionId}-${Date.now()}.md`);
    await writeFile(handoffFile, handoffContent, 'utf-8');

    // Also write HANDOFF.md to the session's working directory for Claude Code to pick up
    const workingHandoffFile = join(session.cwd, 'HANDOFF.md');
    await writeFile(workingHandoffFile, handoffContent, 'utf-8');

    // Create new session from handoff
    const newSession = this.sessionManager.create({
      name: `${session.name} (continued)`,
      cwd: session.cwd,
      fromHandoff: {
        parentSessionId: sessionId,
        handoffContent,
      },
    });

    // Migrate all clients from old session to new session
    for (const client of session.clients) {
      this.sessionManager.attachClient(newSession.id, client.id, client.type, client.deviceInfo);
    }

    // Archive the old session
    this.sessionManager.archive(sessionId);

    const result: HandoffResult = {
      parentSessionId: sessionId,
      newSessionId: newSession.id,
      handoffFilePath: handoffFile,
      summary: handoffData.summary,
    };

    this.emit('handoff:completed', result);
    return result;
  }

  /**
   * Load a previous handoff file.
   */
  async loadHandoff(filePath: string): Promise<string> {
    return readFile(filePath, 'utf-8');
  }

  /**
   * Manually trigger handoff with custom data (e.g., user-initiated).
   */
  async manualHandoff(sessionId: SessionId, enrichedData: Partial<HandoffData>): Promise<HandoffResult | null> {
    const session = this.sessionManager.get(sessionId);
    if (!session) return null;

    const handoffData: HandoffData = {
      parentSessionId: sessionId,
      timestamp: Date.now(),
      summary: enrichedData.summary ?? `Manual handoff from session "${session.name}"`,
      currentTasks: enrichedData.currentTasks ?? [],
      decisions: enrichedData.decisions ?? [],
      relevantFiles: enrichedData.relevantFiles ?? [],
      blockers: enrichedData.blockers ?? [],
      additionalContext: enrichedData.additionalContext ?? '',
    };

    const handoffContent = generateHandoffMd(handoffData);

    await mkdir(this.handoffDir, { recursive: true });
    const handoffFile = join(this.handoffDir, `${sessionId}-manual-${Date.now()}.md`);
    await writeFile(handoffFile, handoffContent, 'utf-8');

    const workingHandoffFile = join(session.cwd, 'HANDOFF.md');
    await writeFile(workingHandoffFile, handoffContent, 'utf-8');

    const newSession = this.sessionManager.create({
      name: `${session.name} (continued)`,
      cwd: session.cwd,
      fromHandoff: {
        parentSessionId: sessionId,
        handoffContent,
      },
    });

    for (const client of session.clients) {
      this.sessionManager.attachClient(newSession.id, client.id, client.type, client.deviceInfo);
    }

    this.sessionManager.archive(sessionId);

    const result: HandoffResult = {
      parentSessionId: sessionId,
      newSessionId: newSession.id,
      handoffFilePath: handoffFile,
      summary: handoffData.summary,
    };

    this.emit('handoff:completed', result);
    return result;
  }
}
