#!/usr/bin/env node

/**
 * doublt — CLI entry point for doubltmux.
 *
 * Starts the doublt-code server and doubltmux-style session manager.
 * Can also connect to an existing server as a client.
 *
 * doubltmux provides cmux-style UI/UX with:
 * - Workspace management (group sessions together)
 * - Session management (create, switch, list)
 * - Terminal I/O sync (PC <-> mobile)
 * - Ctrl-b prefix keybindings (tmux-compatible)
 */

import { Command } from 'commander';
import { DoubltServer } from '@doublt/server';
import { PaneManager } from './cmux/PaneManager.js';
import { ServerBridge } from './bridge/ServerBridge.js';
import type { ServerMessage, SessionListItem, WorkspaceListItem } from '@doublt/shared';

const program = new Command();

program
  .name('doublt')
  .description('doubltmux — Multi-session coding bridge with mobile sync')
  .version('0.1.0');

program
  .command('start')
  .description('Start the doublt server and open default workspace + session')
  .option('-p, --port <port>', 'Server port', '9800')
  .option('-n, --name <name>', 'Workspace name', 'default')
  .action(async (opts) => {
    const port = parseInt(opts.port, 10);
    const server = new DoubltServer({ port });
    server.start();

    // Connect to ourselves as CLI client
    const token = server.authManager.generateServerToken();
    const bridge = new ServerBridge({
      serverUrl: `ws://127.0.0.1:${port}`,
      token,
      deviceInfo: `cli-local-${process.pid}`,
    });

    const paneManager = new PaneManager();
    let currentWorkspaceId: string | null = null;

    bridge.on('connected', () => {
      console.log('Connected to doublt server');
      bridge.listWorkspaces();
      bridge.listSessions();
    });

    bridge.on('message:workspace:list:result', (msg: ServerMessage & { type: 'workspace:list:result' }) => {
      if (msg.workspaces.length > 0 && !currentWorkspaceId) {
        currentWorkspaceId = msg.workspaces[0].id;
        console.log(`Active workspace: ${msg.workspaces[0].name} (${currentWorkspaceId})`);
      }
    });

    bridge.on('message:workspace:created', (msg: ServerMessage & { type: 'workspace:created' }) => {
      console.log(`\nWorkspace created: ${msg.workspace.name} (${msg.workspace.id})`);
      currentWorkspaceId = msg.workspace.id;
    });

    bridge.on('message:session:list:result', (msg: ServerMessage & { type: 'session:list:result' }) => {
      if (msg.sessions.length > 0) {
        const session = msg.sessions[0];
        if (!paneManager.getPaneBySessionId(session.id)) {
          const pane = paneManager.createPane(session.id);
          pane.updateSessionInfo(session);
          bridge.attachSession(session.id);
          console.log(`Attached to session: ${session.name} (${session.id})`);
        }
      }
    });

    bridge.on('message:session:created', (msg: ServerMessage & { type: 'session:created' }) => {
      const pane = paneManager.createPane(msg.session.id);
      pane.updateSessionInfo(msg.session);
      bridge.attachSession(msg.session.id);
      console.log(`\nSession created: ${msg.session.name} (${msg.session.id})`);
      console.log(`${paneManager.renderStatusBar(process.stdout.columns ?? 80)}`);
    });

    bridge.on('message:chat:message', (msg: ServerMessage & { type: 'chat:message' }) => {
      const pane = paneManager.getPaneBySessionId(msg.message.sessionId);
      if (pane) {
        pane.addMessage(msg.message);
        const source = msg.message.sourceClient?.type ?? msg.message.role;
        console.log(`[${source}] ${msg.message.content}`);
      }
    });

    bridge.on('message:chat:stream', (msg: ServerMessage & { type: 'chat:stream' }) => {
      process.stdout.write(msg.delta);
      if (msg.done) {
        process.stdout.write('\n');
      }
    });

    // Terminal output sync — display output from other clients
    bridge.on('message:terminal:output', (msg: ServerMessage & { type: 'terminal:output' }) => {
      process.stdout.write(msg.output.data);
    });

    // Command status tracking
    bridge.on('message:command:status', (msg: ServerMessage & { type: 'command:status' }) => {
      const cmd = msg.command;
      if (cmd.status === 'completed') {
        console.log(`\n[done] "${cmd.command}" completed (exit ${cmd.exitCode})`);
      } else if (cmd.status === 'failed') {
        console.log(`\n[fail] "${cmd.command}" failed (exit ${cmd.exitCode})`);
      }
    });

    bridge.on('message:handoff:ready', (msg: ServerMessage & { type: 'handoff:ready' }) => {
      console.log(`\n>> Session handoff: ${msg.parentSessionId} -> ${msg.newSessionId}`);
      console.log(`   ${msg.handoffSummary}`);

      const pane = paneManager.createPane(msg.newSessionId);
      bridge.attachSession(msg.newSessionId);
    });

    bridge.on('message:notification', (msg: ServerMessage & { type: 'notification' }) => {
      const n = msg.notification;
      console.log(`\n[${n.type}] ${n.title}: ${n.body}`);
    });

    bridge.on('disconnected', () => {
      console.log('Disconnected from server, reconnecting...');
    });

    bridge.on('reconnect:exhausted', () => {
      console.log('Failed to reconnect. Use "doublt connect" to reconnect manually.');
    });

    bridge.connect();

    // Show pairing info
    const pairing = server.getPairingInfo();
    console.log(`\nMobile pairing code: ${pairing.code}`);
    console.log(`Pairing URL: ${pairing.url}`);

    // Show doubltmux status bar
    console.log(`\n${paneManager.renderStatusBar(process.stdout.columns ?? 80)}`);
    console.log('doubltmux keybindings:');
    console.log('  Ctrl-b ?  help  |  Ctrl-b c  new session  |  Ctrl-b W  new workspace');
    console.log('  Ctrl-b m  pair  |  Ctrl-b w  list sessions |  Ctrl-b S  list workspaces');

    // Handle stdin for interactive mode
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();

      let prefixMode = false;
      let inputBuffer = '';

      process.stdin.on('data', (data: Buffer) => {
        const key = data.toString();

        // Ctrl-b prefix (like tmux)
        if (key === '\x02') {
          prefixMode = true;
          return;
        }

        if (prefixMode) {
          prefixMode = false;
          handleDoubltmuxCommand(key, paneManager, bridge, server, currentWorkspaceId);
          return;
        }

        // Ctrl-c to exit
        if (key === '\x03') {
          server.stop();
          process.exit(0);
        }

        // Enter to send message
        if (key === '\r' || key === '\n') {
          if (inputBuffer.trim()) {
            const pane = paneManager.activePane;
            if (pane) {
              bridge.sendChat(pane.sessionId, inputBuffer.trim());

              // Also sync terminal input to mobile
              bridge.sendTerminalInput(pane.sessionId, inputBuffer.trim() + '\n');
            }
            inputBuffer = '';
            process.stdout.write('\n> ');
          }
          return;
        }

        // Backspace
        if (key === '\x7f') {
          if (inputBuffer.length > 0) {
            inputBuffer = inputBuffer.slice(0, -1);
            process.stdout.write('\b \b');
          }
          return;
        }

        // Regular character
        inputBuffer += key;
        process.stdout.write(key);
      });

      process.stdout.write('> ');

      // Send terminal size on start and on resize
      process.stdout.on('resize', () => {
        const pane = paneManager.activePane;
        if (pane) {
          bridge.sendTerminalResize(
            pane.sessionId,
            process.stdout.columns ?? 80,
            process.stdout.rows ?? 24
          );
        }
      });
    }

    // Graceful shutdown
    process.on('SIGINT', () => {
      bridge.disconnect();
      server.stop();
      process.exit(0);
    });
  });

program
  .command('connect <url>')
  .description('Connect to a running doublt server')
  .option('-t, --token <token>', 'Authentication token')
  .action(async (url, opts) => {
    if (!opts.token) {
      console.error('Token required. Use --token or set DOUBLT_TOKEN env var.');
      process.exit(1);
    }

    const bridge = new ServerBridge({
      serverUrl: url,
      token: opts.token,
    });

    bridge.on('connected', () => {
      console.log(`Connected to ${url}`);
      bridge.listWorkspaces();
      bridge.listSessions();
    });

    bridge.on('message:workspace:list:result', (msg: ServerMessage & { type: 'workspace:list:result' }) => {
      console.log('Workspaces:');
      for (const ws of msg.workspaces) {
        console.log(`  ${ws.index}: ${ws.name} [${ws.status}] (${ws.sessionCount} sessions, ${ws.activeSessionCount} active)`);
      }
    });

    bridge.on('message:session:list:result', (msg: ServerMessage & { type: 'session:list:result' }) => {
      console.log('Sessions:');
      for (const s of msg.sessions) {
        console.log(`  ${s.index}: ${s.name} [${s.status}] (${s.clientCount} clients)`);
      }
    });

    bridge.connect();
  });

program
  .command('pair')
  .description('Generate mobile pairing QR code')
  .action(() => {
    console.log('Start the server first with "doublt start", then use Ctrl-b m to pair.');
  });

function handleDoubltmuxCommand(
  key: string,
  panes: PaneManager,
  bridge: ServerBridge,
  server: DoubltServer,
  currentWorkspaceId: string | null,
): void {
  switch (key) {
    case 'c': // Create new session (in current workspace)
      bridge.createSession(
        `session-${panes.paneCount}`,
        undefined,
        currentWorkspaceId ?? undefined,
      );
      console.log('\nCreating new session...');
      break;

    case 'W': // Create new workspace (uppercase W)
      bridge.createWorkspace(`workspace-${Date.now()}`);
      console.log('\nCreating new workspace...');
      break;

    case 'S': // List workspaces (uppercase S)
      bridge.listWorkspaces();
      console.log('\nListing workspaces...');
      break;

    case 'n': // Next pane
      panes.nextPane();
      console.log(`\nSwitched to: ${panes.activePane?.getStatusLine()}`);
      break;

    case 'p': // Previous pane
      panes.previousPane();
      console.log(`\nSwitched to: ${panes.activePane?.getStatusLine()}`);
      break;

    case 'w': // List sessions
      bridge.listSessions(currentWorkspaceId ?? undefined);
      break;

    case 'm': { // Mobile pairing
      const pairing = server.getPairingInfo();
      console.log(`\nMobile pairing code: ${pairing.code}`);
      console.log(`URL: ${pairing.url}`);
      break;
    }

    case 'h': { // Handoff
      const pane = panes.activePane;
      if (pane) {
        bridge.triggerHandoff(pane.sessionId);
        console.log('\nTriggering handoff...');
      }
      break;
    }

    case 'x': { // Kill pane
      const idx = panes.getAllPanes().indexOf(panes.activePane!);
      if (panes.activePane) {
        bridge.detachSession(panes.activePane.sessionId);
        panes.removePane(idx);
        console.log('\nPane closed');
      }
      break;
    }

    case 'd': // Detach
      console.log('\nDetaching... (server continues running)');
      bridge.disconnect();
      process.exit(0);
      break;

    case 'a': // Toggle approval policy
      console.log('\nApproval policy presets:');
      console.log('  1: Conservative (read-only auto-approve)');
      console.log('  2: Moderate (read + build auto-approve)');
      console.log('  3: Permissive (most auto-approve)');
      console.log('Apply preset via mobile app or server API.');
      break;

    case 't': // Task queue
      console.log('\nTask Queue — manage via mobile app.');
      console.log('  Use mobile app to create, reorder, and monitor tasks.');
      break;

    case '?': // Help
      console.log('\ndoubltmux keybindings:');
      console.log('  Ctrl-b c  Create new session (in current workspace)');
      console.log('  Ctrl-b W  Create new workspace');
      console.log('  Ctrl-b S  List workspaces');
      console.log('  Ctrl-b n  Next pane');
      console.log('  Ctrl-b p  Previous pane');
      console.log('  Ctrl-b w  List sessions');
      console.log('  Ctrl-b m  Mobile pairing');
      console.log('  Ctrl-b h  Handoff session');
      console.log('  Ctrl-b a  Approval policy');
      console.log('  Ctrl-b t  Task queue');
      console.log('  Ctrl-b x  Close pane');
      console.log('  Ctrl-b d  Detach');
      console.log('  Ctrl-b 0-9  Switch to pane by index');
      break;

    default:
      // Numbered pane switching (0-9)
      if (key >= '0' && key <= '9') {
        const idx = parseInt(key, 10);
        if (panes.focusPane(idx)) {
          console.log(`\nSwitched to pane ${idx}: ${panes.activePane?.getStatusLine()}`);
        }
      }
  }
}

program.parse();
