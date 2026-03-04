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

import React from 'react';
import { render } from 'ink';
import { exec } from 'node:child_process';
import { Command } from 'commander';
import { DoubltServer } from '@doublt/server';
import { PaneManager } from './cmux/PaneManager.js';
import { ServerBridge } from './bridge/ServerBridge.js';
import { App } from './tui/App.js';
import type { ServerMessage } from '@doublt/shared';

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

    const paneManager = new PaneManager();

    bridge.on('connected', () => {
      bridge.listWorkspaces();
      bridge.listSessions();
    });

    bridge.connect();

    // Render ink TUI
    const inkApp = render(
      React.createElement(App, { bridge, paneManager, server }),
      { exitOnCtrlC: false },
    );

    // Graceful shutdown
    const shutdown = async () => {
      inkApp.unmount();
      bridge.disconnect();
      await server.stop();
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    await inkApp.waitUntilExit();
    await shutdown();
  });

program
  .command('connect <url>')
  .description('Connect to a running doublt server')
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

program.parse();
