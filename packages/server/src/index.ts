/**
 * doublt-code server — The central orchestrator.
 *
 * Architecture overview:
 * ┌───────────────────────────────────────────────────────────────────┐
 * │                        doublt server                              │
 * │                                                                   │
 * │  ┌──────────────┐ ┌─────────────┐ ┌──────────────┐               │
 * │  │ SessionMgr   │ │ ConnectionMgr│ │ HandoffMgr   │               │
 * │  │ (multi-sess) │ │ (WebSocket)  │ │ (HANDOFF.md) │               │
 * │  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘               │
 * │         │                │                │                       │
 * │  ┌──────┴───────┐ ┌─────┴────────┐ ┌─────┴──────────┐            │
 * │  │ WorkspaceMgr │ │ TerminalSync │ │ NotificationMgr│            │
 * │  │ (workspaces) │ │ (I/O sync)   │ │ (push/in-app)  │            │
 * │  └──────┬───────┘ └──────┬───────┘ └──────┬─────────┘            │
 * │         │                │                │                       │
 * │  ┌──────┴───────┐ ┌─────┴────────┐ ┌─────┴──────────┐            │
 * │  │ ApprovalMgr  │ │ TaskQueueMgr │ │ DigestMgr      │            │
 * │  │ (policies)   │ │ (task queue) │ │ (activity log) │            │
 * │  └──────┬───────┘ └──────┬───────┘ └──────┬─────────┘            │
 * │         │                │                │                       │
 * │  ┌──────┴───────┐ ┌─────┴────────┐ ┌─────┴──────────┐            │
 * │  │ GitMgr       │ │ CostTracker  │ │ SearchMgr      │            │
 * │  │ (git status) │ │ (cost/usage) │ │ (search/tmpl)  │            │
 * │  └──────────────┘ └──────────────┘ └────────────────┘            │
 * │                                                                   │
 * └────────┬──────────────┬───────────────────────────────────────────┘
 *          │              │
 *    ┌─────┴─────┐  ┌────┴──────┐
 *    │  CLI (PC)  │  │  Mobile   │
 *    │ (doubltmux)│  │  (phone)  │
 *    └───────────┘  └───────────┘
 *    Both connected simultaneously — no mode switching!
 */

import { SessionManager } from './session/SessionManager.js';
import { ConnectionManager } from './websocket/ConnectionManager.js';
import { HandoffManager } from './handoff/HandoffManager.js';
import { AuthManager } from './api/AuthManager.js';
import { WorkspaceManager } from './workspace/WorkspaceManager.js';
import { TerminalSyncManager } from './terminal/TerminalSyncManager.js';
import { PtyManager } from './terminal/PtyManager.js';
import { ClaudeSessionRunner } from './claude/ClaudeSessionRunner.js';
import { JsonStore } from './storage/JsonStore.js';
import { NotificationManager } from './notification/NotificationManager.js';
import { ApprovalPolicyManager } from './approval/ApprovalPolicyManager.js';
import { TaskQueueManager } from './taskqueue/TaskQueueManager.js';
import { DigestManager } from './digest/DigestManager.js';
import { GitManager } from './git/GitManager.js';
import { CostTracker } from './cost/CostTracker.js';
import { SearchManager } from './search/SearchManager.js';
import type { ClientMessage, ServerMessage, GitStatus, GitCommit, GitDiff, Session, Workspace, Task, ApprovalPolicy } from '@doublt/shared';

export interface DoubltServerOptions {
  port?: number;
  host?: string;
  baseDir?: string;
}

export class DoubltServer {
  readonly sessionManager: SessionManager;
  readonly connectionManager: ConnectionManager;
  readonly handoffManager: HandoffManager;
  readonly authManager: AuthManager;
  readonly workspaceManager: WorkspaceManager;
  readonly terminalSyncManager: TerminalSyncManager;
  readonly ptyManager: PtyManager;
  readonly claudeRunner: ClaudeSessionRunner;
  readonly jsonStore: JsonStore;
  readonly notificationManager: NotificationManager;
  readonly approvalManager: ApprovalPolicyManager;
  readonly taskQueueManager: TaskQueueManager;
  readonly digestManager: DigestManager;
  readonly gitManager: GitManager;
  readonly costTracker: CostTracker;
  readonly searchManager: SearchManager;

  private port: number;
  private host: string;

  constructor(options: DoubltServerOptions = {}) {
    this.port = options.port ?? 9800;
    this.host = options.host ?? '0.0.0.0';

    this.sessionManager = new SessionManager();
    this.connectionManager = new ConnectionManager();
    this.handoffManager = new HandoffManager(this.sessionManager, options.baseDir);
    this.authManager = new AuthManager();
    this.workspaceManager = new WorkspaceManager(this.sessionManager);
    this.terminalSyncManager = new TerminalSyncManager();
    this.ptyManager = new PtyManager(this.terminalSyncManager);
    this.jsonStore = new JsonStore({ dataDir: options.baseDir });
    this.notificationManager = new NotificationManager();
    this.approvalManager = new ApprovalPolicyManager();
    this.taskQueueManager = new TaskQueueManager();
    this.digestManager = new DigestManager();
    this.gitManager = new GitManager();
    this.costTracker = new CostTracker();
    this.searchManager = new SearchManager();
    this.claudeRunner = new ClaudeSessionRunner(this.ptyManager, this.costTracker);

    this.wireUpEvents();
  }

  private wireUpEvents(): void {
    // ─── Authentication ───────────────────────────────

    this.connectionManager.on('client:authenticate', ({ clientId, token, clientType, deviceInfo }) => {
      const valid = this.authManager.validateToken(token);
      this.connectionManager.sendToClient(clientId, {
        type: 'auth:result',
        success: valid,
        clientId: valid ? clientId : undefined,
        error: valid ? undefined : 'Invalid token',
      });

      if (valid) {
        this.notificationManager.setClientConnected(clientId, true);
      }
    });

    // ─── Client Messages ──────────────────────────────

    this.connectionManager.on('client:message', ({ clientId, message }: { clientId: string; message: ClientMessage }) => {
      this.handleClientMessage(clientId, message);
    });

    // ─── Client Disconnection ─────────────────────────

    this.connectionManager.on('client:disconnected', ({ clientId, attachedSessions }) => {
      for (const sessionId of attachedSessions) {
        this.sessionManager.detachClient(sessionId, clientId);
      }
      this.notificationManager.setClientConnected(clientId, false);
    });

    // ─── Session Updates → Broadcast ──────────────────

    this.sessionManager.on('session:updated', (session) => {
      this.connectionManager.broadcastToAll({
        type: 'session:updated',
        session: {
          id: session.id,
          name: session.name,
          status: session.status,
          clientCount: session.clients.length,
          contextUsage: session.contextUsage,
          lastActivityAt: session.lastActivityAt,
          cwd: session.cwd,
          index: 0, // recalculated on list
          workspaceId: session.workspaceId,
        },
      });
    });

    // ─── Workspace Updates → Broadcast ────────────────

    this.workspaceManager.on('workspace:updated', (workspace) => {
      this.connectionManager.broadcastToAll({
        type: 'workspace:updated',
        workspace: this.workspaceManager.toListItem(workspace),
      });
    });

    this.workspaceManager.on('workspace:deleted', (workspaceId) => {
      this.connectionManager.broadcastToAll({
        type: 'workspace:deleted',
        workspaceId,
      });
    });

    // ─── Handoff Completion → Notify clients ──────────

    this.handoffManager.on('handoff:completed', (result) => {
      this.connectionManager.broadcastToAll({
        type: 'handoff:ready',
        parentSessionId: result.parentSessionId,
        newSessionId: result.newSessionId,
        handoffSummary: result.summary,
      });
      this.notificationManager.notifyHandoffReady(result.parentSessionId, result.newSessionId);
      this.digestManager.logEvent('handoff', result.parentSessionId, `Handoff to ${result.newSessionId}`);
    });

    // ─── Context High → Notify ────────────────────────

    this.sessionManager.on('session:handoff_needed', (session) => {
      this.notificationManager.notifyContextHigh(session.id, session.contextUsage);
    });

    // ─── Terminal Sync Events ─────────────────────────

    this.terminalSyncManager.on('terminal:output', (output) => {
      this.connectionManager.broadcastToSession(output.sessionId, {
        type: 'terminal:output',
        output,
      }, output.sourceClientId);
    });

    this.terminalSyncManager.on('terminal:input', (input) => {
      this.connectionManager.broadcastToSession(input.sessionId, {
        type: 'terminal:output',
        output: {
          sessionId: input.sessionId,
          chunkId: 0,
          data: input.data,
          sourceClientId: input.sourceClientId,
          timestamp: input.timestamp,
        },
      }, input.sourceClientId);
    });

    this.terminalSyncManager.on('terminal:resized', (resize) => {
      this.connectionManager.broadcastToSession(resize.sessionId, {
        type: 'terminal:resized',
        resize,
      });
    });

    // ─── Long-running Command Notifications ───────────

    this.terminalSyncManager.on('command:status', (command) => {
      this.connectionManager.broadcastToSession(command.sessionId, {
        type: 'command:status',
        command,
      });
      this.digestManager.logEvent('command', command.sessionId, `Command: ${command.command} (${command.status})`);
    });

    this.terminalSyncManager.on('command:completed_notification', (command) => {
      this.notificationManager.notifyCommandComplete(command);
    });

    // ─── Notification Pipeline → WebSocket ────────────

    this.notificationManager.on('notification:send', (notification) => {
      this.connectionManager.broadcastToSession(notification.sessionId, {
        type: 'notification',
        notification,
      });
    });

    // ─── Approval Policy Events ───────────────────────

    this.approvalManager.on('approval:needed', (item) => {
      this.connectionManager.broadcastToAll({
        type: 'approval:needed',
        item,
      });
      this.digestManager.logEvent('tool_use', item.sessionId, `Approval needed: ${item.toolName}`);
    });

    this.approvalManager.on('approval:decided', (decision) => {
      this.connectionManager.broadcastToAll({
        type: 'approval:decided',
        decision,
      });
    });

    // ─── Task Queue Events ────────────────────────────

    this.taskQueueManager.on('task:created', (task) => {
      this.connectionManager.broadcastToAll({ type: 'task:created', task });
      this.digestManager.logEvent('command', task.sessionId ?? '', `Task created: ${task.title}`);
    });

    this.taskQueueManager.on('task:started', (task) => {
      this.connectionManager.broadcastToAll({ type: 'task:updated', task });
    });

    this.taskQueueManager.on('task:completed', (task) => {
      this.connectionManager.broadcastToAll({ type: 'task:updated', task });
      this.digestManager.logEvent('command', task.sessionId ?? '', `Task completed: ${task.title}`);
    });

    this.taskQueueManager.on('task:failed', (task) => {
      this.connectionManager.broadcastToAll({ type: 'task:updated', task });
      this.digestManager.logEvent('error', task.sessionId ?? '', `Task failed: ${task.title}`);
    });

    this.taskQueueManager.on('task:cancelled', (task) => {
      this.connectionManager.broadcastToAll({ type: 'task:updated', task });
    });

    // ─── Git Status Events ────────────────────────────

    this.gitManager.on('git:status_changed', ({ sessionId, status }: { sessionId: string; status: GitStatus }) => {
      this.connectionManager.broadcastToAll({
        type: 'git:status:result',
        sessionId,
        status,
      });
    });

    this.gitManager.on('git:new_commit', ({ sessionId, commit }: { sessionId: string; commit: GitCommit }) => {
      this.digestManager.logEvent('commit', sessionId, `New commit: ${commit.message}`);
    });

    // ─── Cost Tracking Events ─────────────────────────

    this.costTracker.on('cost:updated', (estimate) => {
      this.connectionManager.broadcastToAll({
        type: 'cost:update',
        sessionId: estimate.sessionId,
        usage: estimate.usage,
        estimatedCostUsd: estimate.estimatedCostUsd,
      });
    });

    this.costTracker.on('budget:alert', (alert) => {
      this.connectionManager.broadcastToAll({ type: 'budget:alert', alert });
    });

    this.costTracker.on('budget:exceeded', (alert) => {
      this.connectionManager.broadcastToAll({ type: 'budget:alert', alert });
    });

    // ─── Search Events ────────────────────────────────

    this.searchManager.on('search:indexed', () => {
      // Indexing events are internal, no broadcast needed
    });

    // ─── Claude Session Runner Events ─────────────────

    this.claudeRunner.on('claude:started', ({ sessionId, prompt }) => {
      this.digestManager.logEvent('command', sessionId, `Claude started${prompt ? `: ${prompt.slice(0, 100)}` : ''}`);
    });

    this.claudeRunner.on('claude:crashed', ({ sessionId, exitCode, restartCount, willRestart }) => {
      this.connectionManager.broadcastToSession(sessionId, {
        type: 'notification',
        notification: {
          sessionId,
          type: 'error',
          title: 'Claude crashed',
          body: `Exit code ${exitCode}. Restart ${restartCount}/${5}. ${willRestart ? 'Auto-restarting...' : 'Giving up.'}`,
          timestamp: Date.now(),
          priority: 'high',
          pushEnabled: true,
        },
      });
      this.digestManager.logEvent('error', sessionId, `Claude crashed (exit ${exitCode}, restart ${restartCount})`);
    });

    this.claudeRunner.on('claude:max_restarts', ({ sessionId }) => {
      // Mark associated task as failed
      const taskId = this.claudeRunner.getTaskForSession(sessionId);
      if (taskId) {
        this.taskQueueManager.failTask(taskId, 'Max restarts exceeded');
        this.claudeRunner.clearTaskForSession(sessionId);
      }

      this.connectionManager.broadcastToSession(sessionId, {
        type: 'notification',
        notification: {
          sessionId,
          type: 'error',
          title: 'Claude stopped — max restarts exceeded',
          body: 'Manual restart required. Check session for errors.',
          timestamp: Date.now(),
          priority: 'critical',
          pushEnabled: true,
        },
      });
    });

    this.claudeRunner.on('claude:completed', ({ sessionId }) => {
      // Mark associated task as completed
      const taskId = this.claudeRunner.getTaskForSession(sessionId);
      if (taskId) {
        this.taskQueueManager.completeTask(taskId);
        this.claudeRunner.clearTaskForSession(sessionId);
      }

      this.connectionManager.broadcastToSession(sessionId, {
        type: 'notification',
        notification: {
          sessionId,
          type: 'completed',
          title: 'Claude finished',
          body: 'Task completed successfully.',
          timestamp: Date.now(),
          priority: 'normal',
          pushEnabled: true,
        },
      });
      this.digestManager.logEvent('command', sessionId, 'Claude completed');

      // Auto-dequeue next task if available
      this.autoDequeueNextTask();
    });

    this.claudeRunner.on('claude:budget_paused', ({ sessionId }) => {
      this.connectionManager.broadcastToSession(sessionId, {
        type: 'notification',
        notification: {
          sessionId,
          type: 'error',
          title: 'Budget exceeded — auto mode paused',
          body: 'Resume manually after reviewing costs.',
          timestamp: Date.now(),
          priority: 'high',
          pushEnabled: true,
        },
      });
    });

    // ─── Auto Task Execution ────────────────────────────

    this.taskQueueManager.on('task:created', (_task) => {
      // Check if we should auto-start the next task
      const running = this.claudeRunner.listSessions().filter(s => s.status === 'running');
      if (running.length === 0) {
        this.autoDequeueNextTask();
      }
    });

    // ─── JsonStore Events ───────────────────────────────

    this.jsonStore.on('store:corrupted', ({ filename }) => {
      console.warn(`[JsonStore] Corrupted file detected: ${filename}, attempting backup restore`);
    });

    this.jsonStore.on('store:restored_from_backup', ({ filename }) => {
      console.log(`[JsonStore] Restored from backup: ${filename}`);
    });

    // ─── PTY Events ────────────────────────────────────

    this.ptyManager.on('pty:exited', ({ sessionId, exitCode, signal }) => {
      this.connectionManager.broadcastToSession(sessionId, {
        type: 'notification',
        notification: {
          sessionId,
          type: exitCode === 0 ? 'completed' : 'error',
          title: 'Terminal process exited',
          body: `Shell exited with code ${exitCode}${signal ? ` (signal ${signal})` : ''}`,
          timestamp: Date.now(),
          priority: exitCode === 0 ? 'low' : 'high',
          pushEnabled: exitCode !== 0,
        },
      });
      this.digestManager.logEvent('command', sessionId, `PTY exited (code ${exitCode})`);
    });
  }

  private handleClientMessage(clientId: string, msg: ClientMessage): void {
    const clientType = this.connectionManager.getClientType(clientId);

    switch (msg.type) {
      case 'session:create': {
        const session = this.sessionManager.create(msg.options);
        this.sessionManager.attachClient(session.id, clientId, clientType ?? 'cli', '');

        // If workspace specified, add session to workspace
        if (msg.options.workspaceId) {
          this.workspaceManager.addSession(msg.options.workspaceId, session.id);
        }

        this.connectionManager.sendToClient(clientId, {
          type: 'session:created',
          session: {
            id: session.id,
            name: session.name,
            status: session.status,
            clientCount: 1,
            contextUsage: 0,
            lastActivityAt: session.lastActivityAt,
            cwd: session.cwd,
            index: 0,
            workspaceId: session.workspaceId,
          },
        });

        // Spawn PTY for the session
        this.ptyManager.spawn(session.id, { cwd: session.cwd }).catch(err => {
          this.connectionManager.sendToClient(clientId, {
            type: 'notification',
            notification: {
              sessionId: session.id,
              type: 'error',
              title: 'PTY spawn failed',
              body: err.message,
              timestamp: Date.now(),
              priority: 'high',
              pushEnabled: true,
            },
          });
        });

        // Index session for search
        this.searchManager.indexSession(session.id, session.name, session.cwd);
        this.digestManager.logEvent('message', session.id, `Session created: ${session.name}`);
        break;
      }

      case 'session:attach': {
        const ok = this.sessionManager.attachClient(
          msg.sessionId, clientId, clientType ?? 'cli', ''
        );
        if (!ok) {
          this.connectionManager.sendToClient(clientId, {
            type: 'error',
            code: 'SESSION_NOT_FOUND',
            message: `Session ${msg.sessionId} not found`,
            sessionId: msg.sessionId,
          });
        }
        break;
      }

      case 'session:detach': {
        this.sessionManager.detachClient(msg.sessionId, clientId);
        break;
      }

      case 'session:list': {
        const sessions = this.sessionManager.list(msg.workspaceId);
        this.connectionManager.sendToClient(clientId, {
          type: 'session:list:result',
          sessions,
        });
        break;
      }

      case 'chat:send': {
        this.sessionManager.updateActivity(msg.sessionId);
        const chatMsg = {
          id: `msg-${Date.now()}`,
          sessionId: msg.sessionId,
          role: 'user' as const,
          content: msg.content,
          timestamp: Date.now(),
          sourceClient: { id: clientId, type: clientType ?? 'cli' as const },
        };
        this.connectionManager.broadcastToSession(msg.sessionId, {
          type: 'chat:message',
          message: chatMsg,
        });
        // Index message for search
        this.searchManager.indexMessage(msg.sessionId, chatMsg.id, msg.content, chatMsg.timestamp);
        this.digestManager.logEvent('message', msg.sessionId, `Message from ${clientType ?? 'cli'}`);
        break;
      }

      case 'tool:approve': {
        this.connectionManager.broadcastToSession(msg.sessionId, {
          type: 'tool:use',
          tool: {
            id: msg.toolUseId,
            sessionId: msg.sessionId,
            toolName: 'approval',
            input: { approved: msg.approved },
            status: msg.approved ? 'completed' : 'failed',
            timestamp: Date.now(),
          },
        }, clientId);
        break;
      }

      case 'handoff:trigger': {
        this.handoffManager.prepareHandoff(msg.sessionId).catch(err => {
          this.connectionManager.sendToClient(clientId, {
            type: 'error',
            code: 'HANDOFF_FAILED',
            message: err.message,
            sessionId: msg.sessionId,
          });
        });
        break;
      }

      // ─── Workspace messages ──────────────────────────

      case 'workspace:create': {
        const workspace = this.workspaceManager.create(msg.options);
        this.connectionManager.sendToClient(clientId, {
          type: 'workspace:created',
          workspace: this.workspaceManager.toListItem(workspace),
        });
        this.connectionManager.broadcastToAll({
          type: 'workspace:created',
          workspace: this.workspaceManager.toListItem(workspace),
        });
        this.searchManager.indexWorkspace(workspace.id, workspace.name, workspace.cwd);
        break;
      }

      case 'workspace:list': {
        const workspaces = this.workspaceManager.list();
        this.connectionManager.sendToClient(clientId, {
          type: 'workspace:list:result',
          workspaces,
        });
        break;
      }

      case 'workspace:delete': {
        this.workspaceManager.archive(msg.workspaceId);
        break;
      }

      case 'workspace:rename': {
        this.workspaceManager.rename(msg.workspaceId, msg.name);
        break;
      }

      // ─── Terminal sync messages ──────────────────────

      case 'terminal:input': {
        // Route input to PTY if available, otherwise just relay
        if (this.ptyManager.isAlive(msg.input.sessionId)) {
          this.ptyManager.write(msg.input.sessionId, msg.input.data);
        }
        this.terminalSyncManager.handleInput(msg.input);
        break;
      }

      case 'terminal:resize': {
        // Resize PTY if available
        if (this.ptyManager.isAlive(msg.resize.sessionId)) {
          this.ptyManager.resize(msg.resize.sessionId, msg.resize.cols, msg.resize.rows);
        }
        this.terminalSyncManager.handleResize(msg.resize);
        break;
      }

      // ─── Push notification registration ──────────────

      case 'push:register': {
        this.notificationManager.registerPushToken(clientId, msg.pushToken, msg.platform);
        break;
      }

      case 'push:unregister': {
        this.notificationManager.unregisterPushToken(clientId);
        break;
      }

      // ─── Approval policy messages ────────────────────

      case 'policy:set': {
        if (msg.preset) {
          const policy = this.approvalManager.applyPreset(msg.preset);
          this.connectionManager.sendToClient(clientId, { type: 'policy:result', policy });
        } else if (msg.policy) {
          const existing = this.approvalManager.updatePolicy(msg.policy.id, msg.policy);
          if (!existing) {
            const created = this.approvalManager.createPolicy(msg.policy.name, msg.policy.description, msg.policy.rules);
            this.connectionManager.sendToClient(clientId, { type: 'policy:result', policy: created });
          } else {
            this.connectionManager.sendToClient(clientId, { type: 'policy:result', policy: existing });
          }
        }
        break;
      }

      case 'policy:get': {
        const activePolicy = this.approvalManager.getActivePolicy();
        this.connectionManager.sendToClient(clientId, { type: 'policy:result', policy: activePolicy });
        break;
      }

      case 'policy:list': {
        const policies = this.approvalManager.listPolicies();
        this.connectionManager.sendToClient(clientId, { type: 'policy:list:result', policies });
        break;
      }

      case 'approval:queue:list': {
        const queue = this.approvalManager.listPendingApprovals();
        this.connectionManager.sendToClient(clientId, { type: 'approval:queue:result', queue });
        break;
      }

      case 'approval:decide': {
        const decision = this.approvalManager.decideApproval(msg.queueItemId, msg.approved, clientId, msg.reason);
        if (decision) {
          this.connectionManager.broadcastToAll({ type: 'approval:decided', decision });
        }
        break;
      }

      // ─── Task queue messages ─────────────────────────

      case 'task:create': {
        const task = this.taskQueueManager.createTask(msg.title, msg.description, msg.priority, msg.workspaceId, msg.sessionId);
        this.connectionManager.sendToClient(clientId, { type: 'task:created', task });
        break;
      }

      case 'task:update': {
        const updated = this.taskQueueManager.updateTask(msg.taskId, msg.updates);
        if (updated) {
          this.connectionManager.broadcastToAll({ type: 'task:updated', task: updated });
        }
        break;
      }

      case 'task:delete': {
        const deleted = this.taskQueueManager.deleteTask(msg.taskId);
        if (deleted) {
          this.connectionManager.broadcastToAll({ type: 'task:deleted', taskId: msg.taskId });
        }
        break;
      }

      case 'task:reorder': {
        this.taskQueueManager.reorderTasks(msg.taskIds);
        const tasks = this.taskQueueManager.listTasks();
        this.connectionManager.sendToClient(clientId, { type: 'task:list:result', tasks });
        break;
      }

      case 'task:list': {
        const tasks = this.taskQueueManager.listTasks(msg.workspaceId);
        this.connectionManager.sendToClient(clientId, { type: 'task:list:result', tasks });
        break;
      }

      // ─── Digest & timeline messages ──────────────────

      case 'digest:request': {
        const digest = this.digestManager.generateDigest(msg.since);
        this.connectionManager.sendToClient(clientId, { type: 'digest:result', digest });
        break;
      }

      case 'timeline:request': {
        const entries = this.digestManager.getTimeline(msg.sessionId, {
          limit: msg.limit,
          offset: msg.offset,
        });
        this.connectionManager.sendToClient(clientId, { type: 'timeline:result', entries });
        break;
      }

      case 'history:request': {
        const page = this.digestManager.getHistory(msg.sessionId, msg.cursor, msg.limit);
        this.connectionManager.sendToClient(clientId, { type: 'history:result', page });
        break;
      }

      // ─── Git status messages ─────────────────────────

      case 'git:status:request': {
        const session = this.sessionManager.get(msg.sessionId);
        if (session) {
          this.gitManager.getStatus(session.cwd).then((status: GitStatus) => {
            this.connectionManager.sendToClient(clientId, {
              type: 'git:status:result',
              sessionId: msg.sessionId,
              status,
            });
          }).catch(() => {
            // Not a git repo or error — send empty status
          });
        }
        break;
      }

      case 'git:log:request': {
        const session2 = this.sessionManager.get(msg.sessionId);
        if (session2) {
          this.gitManager.getLog(session2.cwd, msg.count).then((commits: GitCommit[]) => {
            this.connectionManager.sendToClient(clientId, {
              type: 'git:log:result',
              sessionId: msg.sessionId,
              commits,
            });
          }).catch(() => {});
        }
        break;
      }

      case 'git:diff:request': {
        const session3 = this.sessionManager.get(msg.sessionId);
        if (session3) {
          this.gitManager.getDiff(session3.cwd, msg.filePath, msg.staged).then((diffs: GitDiff[]) => {
            this.connectionManager.sendToClient(clientId, {
              type: 'git:diff:result',
              sessionId: msg.sessionId,
              diffs,
            });
          }).catch(() => {});
        }
        break;
      }

      // ─── Cost & usage messages ───────────────────────

      case 'usage:request': {
        let summary;
        if (msg.period === 'weekly') {
          summary = this.costTracker.getWeeklySummary();
        } else if (msg.period === 'monthly') {
          summary = this.costTracker.getMonthlySummary();
        } else {
          summary = this.costTracker.getDailySummary();
        }
        this.connectionManager.sendToClient(clientId, { type: 'usage:result', summary });
        break;
      }

      case 'budget:set': {
        this.costTracker.setBudget(msg.config);
        break;
      }

      // ─── Search & template messages ──────────────────

      case 'search:query': {
        const results = this.searchManager.search(msg.query);
        this.connectionManager.sendToClient(clientId, { type: 'search:result', results });
        break;
      }

      case 'template:list': {
        const templates = this.searchManager.listTemplates(msg.category as 'code_review' | 'bug_fix' | 'feature_dev' | 'refactoring' | 'custom' | undefined);
        this.connectionManager.sendToClient(clientId, { type: 'template:list:result', templates });
        break;
      }

      case 'template:create': {
        const template = this.searchManager.createTemplate(msg.name, msg.description, msg.category as 'code_review' | 'bug_fix' | 'feature_dev' | 'refactoring' | 'custom', msg.prompts, msg.tags ?? []);
        this.connectionManager.sendToClient(clientId, { type: 'template:created', template });
        break;
      }

      case 'template:use': {
        const used = this.searchManager.useTemplate(msg.templateId);
        if (used) {
          this.connectionManager.sendToClient(clientId, { type: 'template:used', template: used });
        }
        break;
      }

      // ─── Claude session messages ────────────────────────

      case 'claude:start': {
        this.claudeRunner.startClaude(msg.sessionId, {
          prompt: msg.prompt,
          autoRestart: msg.autoRestart ?? true,
        }).then(() => {
          this.connectionManager.sendToClient(clientId, {
            type: 'claude:status:result',
            sessions: this.claudeRunner.listSessions().map(s => ({
              sessionId: s.sessionId,
              status: s.status,
              restartCount: s.restartCount,
              lastStartedAt: s.lastStartedAt,
            })),
          });
        }).catch(err => {
          this.connectionManager.sendToClient(clientId, {
            type: 'error',
            code: 'CLAUDE_START_FAILED',
            message: err.message,
            sessionId: msg.sessionId,
          });
        });
        break;
      }

      case 'claude:stop': {
        this.claudeRunner.stopClaude(msg.sessionId).then(() => {
          this.connectionManager.sendToClient(clientId, {
            type: 'claude:status:result',
            sessions: this.claudeRunner.listSessions().map(s => ({
              sessionId: s.sessionId,
              status: s.status,
              restartCount: s.restartCount,
              lastStartedAt: s.lastStartedAt,
            })),
          });
        }).catch(() => {});
        break;
      }

      case 'claude:status': {
        const claudeSessions = msg.sessionId
          ? this.claudeRunner.listSessions().filter(s => s.sessionId === msg.sessionId)
          : this.claudeRunner.listSessions();
        this.connectionManager.sendToClient(clientId, {
          type: 'claude:status:result',
          sessions: claudeSessions.map(s => ({
            sessionId: s.sessionId,
            status: s.status,
            restartCount: s.restartCount,
            lastStartedAt: s.lastStartedAt,
          })),
        });
        break;
      }
    }
  }

  /**
   * Auto-dequeue and start the next queued task in a new or existing session.
   */
  private autoDequeueNextTask(): void {
    const next = this.taskQueueManager.dequeueNext();
    if (!next) return;

    this.taskQueueManager.startTask(next.id);

    // Find or create a session for the task
    const sessionId = next.sessionId;
    if (sessionId && this.sessionManager.get(sessionId)) {
      // Track task-to-session mapping for completion
      this.claudeRunner.setTaskForSession(sessionId, next.id);
      this.claudeRunner.startClaude(sessionId, {
        prompt: `${next.title}\n\n${next.description}`,
        autoRestart: true,
      }).catch(err => {
        this.claudeRunner.clearTaskForSession(sessionId);
        this.taskQueueManager.failTask(next.id, err.message);
      });
    } else {
      // Create a new session for the task
      const session = this.sessionManager.create({
        name: `task-${next.id}`,
        workspaceId: next.workspaceId,
      });

      // Track task-to-session mapping for completion
      this.claudeRunner.setTaskForSession(session.id, next.id);
      this.ptyManager.spawn(session.id).then(() => {
        return this.claudeRunner.startClaude(session.id, {
          prompt: `${next.title}\n\n${next.description}`,
          autoRestart: true,
        });
      }).catch(err => {
        this.claudeRunner.clearTaskForSession(session.id);
        this.taskQueueManager.failTask(next.id, err.message);
      });
    }
  }

  /**
   * Save all manager state to JSON files using full raw objects.
   */
  async saveState(): Promise<void> {
    const sessions = this.sessionManager.listAll();
    const workspaces = this.workspaceManager.listAllWorkspaces();
    const tasks = this.taskQueueManager.listTasks();
    const policies = this.approvalManager.listPolicies();

    await Promise.all([
      this.jsonStore.save('sessions.json', sessions),
      this.jsonStore.save('workspaces.json', workspaces),
      this.jsonStore.save('tasks.json', tasks),
      this.jsonStore.save('policies.json', policies),
    ]);
  }

  /**
   * Load persisted state from disk and restore all managers.
   * Returns true if any state was restored.
   */
  async loadState(): Promise<boolean> {
    const [sessions, workspaces, tasks, policies] = await Promise.all([
      this.jsonStore.load<Session[]>('sessions.json'),
      this.jsonStore.load<Workspace[]>('workspaces.json'),
      this.jsonStore.load<Task[]>('tasks.json'),
      this.jsonStore.load<ApprovalPolicy[]>('policies.json'),
    ]);

    let restored = false;
    if (sessions?.length) { this.sessionManager.restoreSessions(sessions); restored = true; }
    if (workspaces?.length) { this.workspaceManager.restoreWorkspaces(workspaces); restored = true; }
    if (tasks?.length) { this.taskQueueManager.restoreTasks(tasks); restored = true; }
    if (policies?.length) { this.approvalManager.restorePolicies(policies); restored = true; }

    return restored;
  }

  /**
   * Schedule debounced state persistence on any state change.
   */
  private scheduleSave(filename: string, getData: () => unknown): void {
    this.jsonStore.scheduleSave(filename, getData());
  }

  async start(): Promise<void> {
    const serverToken = this.authManager.generateServerToken();
    this.connectionManager.start(this.port);

    console.log(`doublt-code server started on port ${this.port}`);
    console.log(`Server token: ${serverToken}`);

    // Try to restore previous state from disk
    const restored = await this.loadState();

    if (!restored) {
      // First run — create a default workspace and session
      const defaultWorkspace = this.workspaceManager.create({ name: 'default' });
      const defaultSession = this.sessionManager.create({
        name: 'default',
        workspaceId: defaultWorkspace.id,
      });
      this.workspaceManager.addSession(defaultWorkspace.id, defaultSession.id);

      // Index defaults for search
      this.searchManager.indexWorkspace(defaultWorkspace.id, defaultWorkspace.name, defaultWorkspace.cwd);
      this.searchManager.indexSession(defaultSession.id, defaultSession.name, defaultSession.cwd);
    } else {
      console.log('Restored previous state from disk');
    }

    // Periodic cleanup + auto-save every 30s
    setInterval(() => {
      this.sessionManager.pruneStaleClients();
      this.authManager.cleanup();
      this.notificationManager.cleanup();
      this.digestManager.clearOldEvents(Date.now() - 7 * 24 * 60 * 60 * 1000);
      this.saveState().catch(err => console.warn('[doublt] saveState error:', err));
    }, 30_000);
  }

  async stop(): Promise<void> {
    // Save all state before shutting down
    try {
      await this.jsonStore.flush();
      await this.saveState();
    } catch {
      // Best-effort save on shutdown
    }

    this.claudeRunner.destroy();
    this.taskQueueManager.destroy();
    this.jsonStore.destroy();
    await this.ptyManager.killAll().catch(() => {});
    this.connectionManager.stop();
  }

  /**
   * Get pairing info for mobile connection.
   */
  getPairingInfo(): { url: string; code: string } {
    const { url, code } = this.authManager.generatePairingUrl(this.host, this.port);
    return { url, code };
  }
}

// Standalone CLI entry point — only runs when this file is the direct entry
const isDirectEntry = process.argv[1] && (
  process.argv[1].includes('packages/server/src/index') ||
  process.argv[1].includes('packages/server/dist/index')
);
if (isDirectEntry) {
  const port = parseInt(process.env.DOUBLT_PORT ?? '9800', 10);
  const server = new DoubltServer({ port });

  const shutdown = async () => {
    await server.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  server.start().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

export { SessionManager } from './session/SessionManager.js';
export { ConnectionManager } from './websocket/ConnectionManager.js';
export { HandoffManager } from './handoff/HandoffManager.js';
export { AuthManager } from './api/AuthManager.js';
export { WorkspaceManager } from './workspace/WorkspaceManager.js';
export { TerminalSyncManager } from './terminal/TerminalSyncManager.js';
export { PtyManager } from './terminal/PtyManager.js';
export { ClaudeSessionRunner } from './claude/ClaudeSessionRunner.js';
export { JsonStore } from './storage/JsonStore.js';
export { NotificationManager } from './notification/NotificationManager.js';
export { ApprovalPolicyManager } from './approval/ApprovalPolicyManager.js';
export { TaskQueueManager } from './taskqueue/TaskQueueManager.js';
export { DigestManager } from './digest/DigestManager.js';
export { GitManager } from './git/GitManager.js';
export { CostTracker } from './cost/CostTracker.js';
export { SearchManager } from './search/SearchManager.js';
