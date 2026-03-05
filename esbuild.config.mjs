import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

await build({
  entryPoints: ['packages/cli/src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist/index.js',
  define: {
    '__PKG_VERSION__': JSON.stringify(pkg.version),
  },
  external: [
    'node:*',
    'node-pty',
    'ws', 'express', 'commander',
    'chokidar', 'fsevents',
  ],
});
