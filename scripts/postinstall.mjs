#!/usr/bin/env node

const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;

console.log('');
console.log(bold('tt-code') + ' installed successfully!');
console.log('');
console.log(`  ${cyan('tt-code start')}     Start server + web GUI`);
console.log(`  ${cyan('tt-code --help')}    Show all commands`);
console.log('');
console.log(dim('Optional: install node-pty for native terminal support:'));
console.log(dim('  npm install -g node-pty'));
console.log('');
