# doublt-code

Multi-session coding bridge with mobile sync. Combines the best of Happy Coder (phone-PC session linking) with cmux-style multi-session management.

## Architecture

Monorepo with 5 packages:
- `packages/shared` — Types, wire protocol, handoff utilities
- `packages/server` — Session manager, WebSocket server, handoff engine, auth, PTY terminal, JSON persistence
- `packages/cli` — CLI entry point, cmux pane manager, server bridge, PTY passthrough
- `packages/mobile` — React Native (Expo) mobile app, offline cache, sync queue
- `packages/web` — Web GUI with xterm.js terminal

## Key Design Decisions

1. **No mode switching** — Unlike Happy Coder's remote/local split, all clients (PC + mobile) connect simultaneously via unified WebSocket protocol
2. **cmux-style sessions** — Multiple sessions managed like tmux panes with Ctrl-b prefix keys
3. **Auto handoff** — Context usage tracked per session; HANDOFF.md generated when nearing limit, new session created automatically
4. **Heartbeat-based liveness** — Prevents "stuck" connections; stale clients are pruned automatically
5. **PTY terminal passthrough** — Real shell via node-pty, scrollback buffer (1000 lines), reconnect restore
6. **JSON file persistence** — Atomic writes to ~/.doublt/data/, debounced auto-save, backup on corruption
7. **Claude CLI auto-mode** — `claude --dangerously-skip-permissions` inside PTY, crash restart with exponential backoff
8. **Mobile offline** — AsyncStorage cache + SyncQueue with server-wins conflict resolution

## Commands

```
pnpm install        # install all workspace deps
pnpm run build      # build all packages (shared → server → cli)
pnpm test           # run all 314 tests
pnpm run dev:server # start server in dev mode
pnpm run dev:cli    # start CLI in dev mode
doublt start        # start server + default session
doublt pair         # mobile pairing
```

## cmux keybindings (inside doublt session)

Ctrl-b c = new session, Ctrl-b n/p = next/prev, Ctrl-b w = list,
Ctrl-b m = mobile pair, Ctrl-b h = handoff, Ctrl-b d = detach,
Ctrl-b a = approval policy toggle, Ctrl-b t = task queue,
Ctrl-b g = git status, Ctrl-b $ = cost summary, Ctrl-b ? = help

## Key Server Components

- **PtyManager** — node-pty shell spawn per session, scrollback buffer
- **ClaudeSessionRunner** — claude CLI auto-execution, crash recovery (5x backoff)
- **JsonStore** — Atomic JSON persistence (~/.doublt/data/), debounced save
- **ApprovalPolicyManager** — 4 presets (conservative/moderate/permissive/full_auto), schedule support
- **TunnelManager** — cloudflare/ngrok tunnel with auto-restart and fallback
- **GitManager** — Real git command execution, chokidar file watching
- **DigestManager** — Event logging from all managers, activity timeline

## Docs

- `docs/ROADMAP.md` — 5-phase implementation roadmap (all complete)
- `docs/RUN_AND_DEPLOY.md` — Full run & deploy guide
- `IMPLEMENTATION_PLAN.md` — Original spec (v1)
- `.omc/plans/doublt-code-implementation.md` — Architecture spec (v2)
