#!/usr/bin/env node

import { chmodSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Fix node-pty spawn-helper execute permission (npm strips +x from prebuilds)
const spawnHelperPaths = [
  join(root, 'node_modules', 'node-pty', 'prebuilds', 'darwin-arm64', 'spawn-helper'),
  join(root, 'node_modules', 'node-pty', 'prebuilds', 'darwin-x64', 'spawn-helper'),
];
for (const p of spawnHelperPaths) {
  if (existsSync(p)) {
    try {
      chmodSync(p, 0o755);
    } catch {
      // Non-fatal — may lack permission on some systems
    }
  }
}

const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;

console.log('');
console.log(bold('tt-code') + ' installed successfully!');
console.log('');
console.log(`  ${cyan('tt-code start')}     Start server + web GUI`);
console.log(`  ${cyan('tt-code --help')}    Show all commands`);
console.log('');
