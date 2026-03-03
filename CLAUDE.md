# doublt-code

Multi-session coding bridge with mobile sync. Combines the best of Happy Coder (phone-PC session linking) with cmux-style multi-session management.

## Architecture

Monorepo with 4 packages:
- `packages/shared` — Types, wire protocol, handoff utilities
- `packages/server` — Session manager, WebSocket server, handoff engine, auth
- `packages/cli` — CLI entry point, cmux pane manager, server bridge
- `packages/mobile` — React Native (Expo) mobile app

## Key Design Decisions

1. **No mode switching** — Unlike Happy Coder's remote/local split, all clients (PC + mobile) connect simultaneously via unified WebSocket protocol
2. **cmux-style sessions** — Multiple sessions managed like tmux panes with Ctrl-b prefix keys
3. **Auto handoff** — Context usage tracked per session; HANDOFF.md generated when nearing limit, new session created automatically
4. **Heartbeat-based liveness** — Prevents "stuck" connections; stale clients are pruned automatically

## Commands

```
npm install         # install all workspace deps
npm run dev:server  # start server in dev mode
npm run dev:cli     # start CLI in dev mode
doublt start        # start server + default session
doublt pair         # mobile pairing
```

## cmux keybindings (inside doublt session)

Ctrl-b c = new session, Ctrl-b n/p = next/prev, Ctrl-b w = list,
Ctrl-b m = mobile pair, Ctrl-b h = handoff, Ctrl-b d = detach
