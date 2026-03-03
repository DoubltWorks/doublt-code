/**
 * CLI command definitions for doublt-code.
 *
 * Usage:
 *   doublt start              Start the server and default session
 *   doublt connect [url]      Connect to a running server
 *   doublt pair               Show QR code for mobile pairing
 *   doublt sessions           List all sessions
 *   doublt attach <id>        Attach to a session
 *   doublt new [name]         Create a new session
 *   doublt handoff [id]       Trigger context handoff
 *
 * cmux shortcuts (when inside doublt):
 *   Ctrl-b c    Create new session pane
 *   Ctrl-b n    Next pane
 *   Ctrl-b p    Previous pane
 *   Ctrl-b w    List sessions
 *   Ctrl-b d    Detach
 *   Ctrl-b m    Mobile pairing
 *   Ctrl-b h    Handoff current session
 */

export interface CommandConfig {
  name: string;
  description: string;
  aliases?: string[];
  args?: Array<{ name: string; required?: boolean; description: string }>;
  options?: Array<{ flags: string; description: string; default?: string }>;
}

export const commands: CommandConfig[] = [
  {
    name: 'start',
    description: 'Start the doublt server and open the default session',
    options: [
      { flags: '-p, --port <port>', description: 'Server port', default: '9800' },
      { flags: '-n, --name <name>', description: 'Initial session name', default: 'default' },
    ],
  },
  {
    name: 'connect',
    description: 'Connect to a running doublt server',
    args: [
      { name: 'url', description: 'Server WebSocket URL (e.g., ws://localhost:9800)' },
    ],
    options: [
      { flags: '-t, --token <token>', description: 'Authentication token' },
    ],
  },
  {
    name: 'pair',
    description: 'Generate a QR code for mobile device pairing',
  },
  {
    name: 'sessions',
    description: 'List all active sessions',
    aliases: ['ls'],
  },
  {
    name: 'attach',
    description: 'Attach to an existing session',
    aliases: ['a'],
    args: [
      { name: 'session-id', required: true, description: 'Session ID or index number' },
    ],
  },
  {
    name: 'new',
    description: 'Create a new session',
    args: [
      { name: 'name', description: 'Session name' },
    ],
    options: [
      { flags: '-d, --dir <dir>', description: 'Working directory for the session' },
    ],
  },
  {
    name: 'handoff',
    description: 'Trigger context handoff for a session',
    args: [
      { name: 'session-id', description: 'Session to handoff (defaults to current)' },
    ],
  },
  {
    name: 'kill',
    description: 'Kill (archive) a session',
    args: [
      { name: 'session-id', required: true, description: 'Session to kill' },
    ],
  },
];
