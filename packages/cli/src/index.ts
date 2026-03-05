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

import { exec } from 'node:child_process';
import { Command } from 'commander';
import { DoubltServer } from '@doublt/server';
import { ServerBridge } from './bridge/ServerBridge.js';
import type { ServerMessage } from '@doublt/shared';

const program = new Command();

// ─── Ctrl-b prefix mode keybinding handler ─────────────────

interface RawTerminalContext {
  bridge: ServerBridge;
  server?: DoubltServer;
  activeSessionId: string | null;
  prefixMode: boolean;
}

function setupRawTerminal(ctx: RawTerminalContext): void {
  const { bridge } = ctx;

  // Enter raw mode
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  // Single message handler for all server messages
  bridge.on('message', (msg: ServerMessage) => {
    switch (msg.type) {
      case 'terminal:output':
        process.stdout.write(msg.output.data);
        break;
      case 'terminal:scrollback:result':
        process.stdout.write(msg.data);
        break;
      case 'session:created':
        if (!ctx.activeSessionId) {
          ctx.activeSessionId = msg.session.id;
          bridge.attachSession(msg.session.id);
          bridge.send({ type: 'terminal:scrollback:request', sessionId: msg.session.id });
        }
        break;
    }
  });

  // Handle stdin → WebSocket → server PTY
  process.stdin.on('data', (data: string) => {
    // Ctrl-b prefix mode
    if (data === '\x02') { // Ctrl-b
      ctx.prefixMode = true;
      return;
    }

    if (ctx.prefixMode) {
      ctx.prefixMode = false;
      handlePrefixKey(data, ctx);
      return;
    }

    // Forward raw input to server PTY
    if (ctx.activeSessionId) {
      bridge.sendTerminalInput(ctx.activeSessionId, data);
    }
  });

  // Send terminal size on connect and resize
  const sendSize = () => {
    if (ctx.activeSessionId && process.stdout.columns && process.stdout.rows) {
      bridge.sendTerminalResize(ctx.activeSessionId, process.stdout.columns, process.stdout.rows);
    }
  };

  bridge.on('connected', sendSize);
  process.stdout.on('resize', sendSize);
}

function handlePrefixKey(key: string, ctx: RawTerminalContext): void {
  const { bridge, server } = ctx;

  switch (key) {
    case 'c': // New session
      bridge.createSession();
      break;

    case 'n': // Next session
      bridge.listSessions();
      // TODO: cycle to next session
      break;

    case 'p': // Previous session
      bridge.listSessions();
      // TODO: cycle to previous session
      break;

    case 'w': // List sessions
      bridge.listSessions();
      bridge.on('message', function onceList(msg: ServerMessage) {
        if (msg.type === 'session:list:result') {
          bridge.removeListener('message', onceList);
          process.stdout.write('\r\n--- Sessions ---\r\n');
          for (const s of msg.sessions) {
            const marker = s.id === ctx.activeSessionId ? '*' : ' ';
            process.stdout.write(`  ${marker} ${s.index}: ${s.name} [${s.status}]\r\n`);
          }
          process.stdout.write('----------------\r\n');
        }
      });
      break;

    case 'm': // Mobile pair
      if (server) {
        const pairing = server.authManager.generatePairingUrl('localhost', 9800);
        process.stdout.write(`\r\nPairing code: ${pairing.code}\r\n`);
        const tunnelUrl = server.tunnelManager?.getUrl();
        if (tunnelUrl) {
          process.stdout.write(`Tunnel URL: ${tunnelUrl}\r\n`);
        }
        process.stdout.write(`Pairing URL: ${pairing.url}\r\n`);
      }
      break;

    case 'h': // Handoff
      if (ctx.activeSessionId) {
        bridge.triggerHandoff(ctx.activeSessionId);
      }
      break;

    case 'W': { // Create workspace
      const wsName = `workspace-${Date.now().toString(36)}`;
      bridge.createWorkspace(wsName);
      process.stdout.write(`\r\n[Workspace] Created: ${wsName}\r\n`);
      break;
    }

    case 'S': { // List workspaces
      bridge.send({ type: 'workspace:list' });
      const onWsList = (msg: ServerMessage) => {
        if (msg.type === 'workspace:list:result') {
          bridge.removeListener('message', onWsList);
          clearTimeout(wsTimeout);
          process.stdout.write('\r\n--- Workspaces ---\r\n');
          if (msg.workspaces.length === 0) {
            process.stdout.write('  (none)\r\n');
          } else {
            for (const ws of msg.workspaces) {
              process.stdout.write(`  ${ws.name} (${ws.sessionCount} sessions)\r\n`);
            }
          }
          process.stdout.write('------------------\r\n');
        }
      };
      const wsTimeout = setTimeout(() => {
        bridge.removeListener('message', onWsList);
        process.stdout.write('\r\n[Workspace] Request timeout\r\n');
      }, 5000);
      bridge.on('message', onWsList);
      break;
    }

    case 'd': // Detach
      if (ctx.activeSessionId) {
        bridge.detachSession(ctx.activeSessionId);
      }
      cleanup(ctx);
      break;

    case 'a': { // Toggle approval policy (conservative <-> full_auto)
      bridge.send({ type: 'approval:toggle' });
      const onToggleResult = (msg: ServerMessage) => {
        if (msg.type === 'policy:result') {
          clearTimeout(toggleTimeout);
          bridge.removeListener('message:policy:result', onToggleResult);
          const name = msg.policy?.name ?? 'None';
          process.stdout.write(`\r\n[Approval] Toggled to: ${name}\r\n`);
        }
      };
      const toggleTimeout = setTimeout(() => {
        bridge.removeListener('message:policy:result', onToggleResult);
        process.stdout.write('\r\n[Approval] Toggle timeout\r\n');
      }, 5000);
      bridge.on('message:policy:result', onToggleResult);
      break;
    }

    case 't': { // Task queue display
      bridge.send({ type: 'task:list' });
      const onTaskList = (msg: ServerMessage) => {
        if (msg.type === 'task:list:result') {
          clearTimeout(taskTimeout);
          bridge.removeListener('message:task:list:result', onTaskList);
          process.stdout.write('\r\n--- Task Queue ---\r\n');
          if (msg.tasks.length === 0) {
            process.stdout.write('  (empty)\r\n');
          } else {
            for (const t of msg.tasks) {
              const icon = t.status === 'running' ? '>' : t.status === 'completed' ? '+' : '-';
              process.stdout.write(`  ${icon} [${t.priority}] ${t.title} (${t.status})\r\n`);
            }
          }
          process.stdout.write('------------------\r\n');
        }
      };
      const taskTimeout = setTimeout(() => {
        bridge.removeListener('message:task:list:result', onTaskList);
        process.stdout.write('\r\n[Tasks] Request timeout\r\n');
      }, 5000);
      bridge.on('message:task:list:result', onTaskList);
      break;
    }

    case 'g': { // Git status display
      if (!ctx.activeSessionId) break;
      bridge.send({ type: 'git:status:request', sessionId: ctx.activeSessionId });
      const onGitStatus = (msg: ServerMessage) => {
        if (msg.type === 'git:status:result') {
          clearTimeout(gitTimeout);
          bridge.removeListener('message:git:status:result', onGitStatus);
          const gs = msg.status;
          process.stdout.write('\r\n--- Git Status ---\r\n');
          process.stdout.write(`  Branch: ${gs.branch}\r\n`);
          if (gs.ahead > 0) process.stdout.write(`  Ahead: ${gs.ahead}\r\n`);
          if (gs.behind > 0) process.stdout.write(`  Behind: ${gs.behind}\r\n`);
          if (gs.staged.length > 0) process.stdout.write(`  Staged: ${gs.staged.length} files\r\n`);
          if (gs.unstaged.length > 0) process.stdout.write(`  Unstaged: ${gs.unstaged.length} files\r\n`);
          if (gs.untracked.length > 0) process.stdout.write(`  Untracked: ${gs.untracked.length} files\r\n`);
          process.stdout.write('------------------\r\n');
        }
      };
      const gitTimeout = setTimeout(() => {
        bridge.removeListener('message:git:status:result', onGitStatus);
        process.stdout.write('\r\n[Git] Request timeout\r\n');
      }, 5000);
      bridge.on('message:git:status:result', onGitStatus);
      break;
    }

    case '$': { // Cost summary display
      bridge.send({ type: 'usage:request', period: 'daily' });
      const onUsage = (msg: ServerMessage) => {
        if (msg.type === 'usage:result') {
          clearTimeout(costTimeout);
          bridge.removeListener('message:usage:result', onUsage);
          const u = msg.summary;
          process.stdout.write('\r\n--- Cost Summary ---\r\n');
          process.stdout.write(`  Total tokens: ${u.totalTokens.toLocaleString()}\r\n`);
          process.stdout.write(`  Est. cost: $${u.totalCostUsd.toFixed(4)}\r\n`);
          if (u.budgetLimit != null && u.budgetLimit > 0) {
            const pct = Math.round((u.budgetUsed / u.budgetLimit) * 100);
            process.stdout.write(`  Budget: ${pct}% used ($${u.budgetUsed.toFixed(2)}/$${u.budgetLimit.toFixed(2)})\r\n`);
          }
          process.stdout.write('--------------------\r\n');
        }
      };
      const costTimeout = setTimeout(() => {
        bridge.removeListener('message:usage:result', onUsage);
        process.stdout.write('\r\n[Cost] Request timeout\r\n');
      }, 5000);
      bridge.on('message:usage:result', onUsage);
      break;
    }

    case '?': // Help
      process.stdout.write('\r\n--- doublt keybindings ---\r\n');
      process.stdout.write('  Ctrl-b c   New session\r\n');
      process.stdout.write('  Ctrl-b n   Next session\r\n');
      process.stdout.write('  Ctrl-b p   Previous session\r\n');
      process.stdout.write('  Ctrl-b w   List sessions\r\n');
      process.stdout.write('  Ctrl-b W   Create workspace\r\n');
      process.stdout.write('  Ctrl-b S   List workspaces\r\n');
      process.stdout.write('  Ctrl-b m   Mobile pair\r\n');
      process.stdout.write('  Ctrl-b h   Handoff\r\n');
      process.stdout.write('  Ctrl-b d   Detach\r\n');
      process.stdout.write('  Ctrl-b a   Toggle approval (conservative/full_auto)\r\n');
      process.stdout.write('  Ctrl-b t   Task queue\r\n');
      process.stdout.write('  Ctrl-b g   Git status\r\n');
      process.stdout.write('  Ctrl-b $   Cost summary\r\n');
      process.stdout.write('  Ctrl-b ?   This help\r\n');
      process.stdout.write('-------------------------\r\n');
      break;

    default:
      // Unknown prefix key — send Ctrl-b + key as-is
      if (ctx.activeSessionId) {
        bridge.sendTerminalInput(ctx.activeSessionId, '\x02' + key);
      }
      break;
  }
}

async function cleanup(ctx: RawTerminalContext): Promise<void> {
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
  ctx.bridge.disconnect();
  if (ctx.server) {
    await ctx.server.stop();
  }
  process.exit(0);
}

// ─── CLI Commands ──────────────────────────────────────────

program
  .name('tt-code')
  .description('tt-code — Multi-session coding bridge with mobile sync')
  .version(typeof __PKG_VERSION__ !== 'undefined' ? __PKG_VERSION__ : '0.0.0');

program
  .command('start')
  .description('Start the tt-code server and open default workspace + session')
  .option('-p, --port <port>', 'Server port', '9800')
  .option('-n, --name <name>', 'Workspace name', 'default')
  .option('--tunnel <provider>', 'Tunnel provider (cloudflare)', 'none')
  .option('--no-gui', 'Disable automatic browser opening')
  .action(async (opts: { port: string; name: string; tunnel: string; gui: boolean }) => {
    const port = parseInt(opts.port, 10);
    const server = new DoubltServer({
      port,
      tunnel: opts.tunnel as 'cloudflare' | 'ngrok' | 'none',
    });
    await server.start();

    // Open web GUI in browser
    const token = server.authManager.generateServerToken();
    if (opts.gui !== false) {
      const webUrl = `http://localhost:${port}/#token=${token}`;
      console.log(`Web GUI: ${webUrl}`);
      const openCmd = process.platform === 'darwin' ? 'open'
        : process.platform === 'win32' ? 'start' : 'xdg-open';
      exec(`${openCmd} "${webUrl}"`, (err) => {
        if (err) console.warn(`Failed to open browser: ${err.message}`);
      });
    }

    // Connect to ourselves as CLI client
    const bridge = new ServerBridge({
      serverUrl: `ws://127.0.0.1:${port}`,
      token,
      deviceInfo: `cli-local-${process.pid}`,
    });

    const ctx: RawTerminalContext = {
      bridge,
      server,
      activeSessionId: null,
      prefixMode: false,
    };

    bridge.on('connected', () => {
      // Create default session with PTY
      bridge.createSession('default');
    });

    bridge.connect();

    // Setup raw terminal passthrough
    setupRawTerminal(ctx);

    // Graceful shutdown
    const shutdown = async () => {
      await cleanup(ctx);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });

program
  .command('connect <url>')
  .description('Connect to a running tt-code server')
  .option('-t, --token <token>', 'Authentication token')
  .action(async (url: string, opts: { token?: string }) => {
    if (!opts.token) {
      console.error('Token required. Use --token or set DOUBLT_TOKEN env var.');
      process.exit(1);
    }

    const bridge = new ServerBridge({
      serverUrl: url,
      token: opts.token,
    });

    const ctx: RawTerminalContext = {
      bridge,
      activeSessionId: null,
      prefixMode: false,
    };

    bridge.on('connected', () => {
      bridge.listSessions();
    });

    // Attach to first available session
    bridge.on('message', (msg: ServerMessage) => {
      if (msg.type === 'session:list:result' && msg.sessions.length > 0 && !ctx.activeSessionId) {
        ctx.activeSessionId = msg.sessions[0].id;
        bridge.attachSession(msg.sessions[0].id);
        bridge.send({ type: 'terminal:scrollback:request', sessionId: msg.sessions[0].id });
      }
    });

    bridge.connect();

    // Setup raw terminal passthrough
    setupRawTerminal(ctx);

    // Graceful shutdown
    const shutdown = async () => {
      await cleanup(ctx);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });

program
  .command('pair')
  .description('Generate mobile pairing QR code')
  .action(() => {
    console.log('Start the server first with "tt-code start", then use Ctrl-b m to pair.');
  });

program.parse();
