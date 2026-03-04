import React from 'react';
import { Box, Text, useInput } from 'ink';

interface Props {
  onClose: () => void;
}

const KEYBINDINGS = [
  { key: 'Ctrl-b c', desc: 'Create new session (in current workspace)' },
  { key: 'Ctrl-b W', desc: 'Create new workspace' },
  { key: 'Ctrl-b S', desc: 'List workspaces' },
  { key: 'Ctrl-b n', desc: 'Next pane' },
  { key: 'Ctrl-b p', desc: 'Previous pane' },
  { key: 'Ctrl-b w', desc: 'List sessions' },
  { key: 'Ctrl-b m', desc: 'Mobile pairing' },
  { key: 'Ctrl-b C', desc: 'Start claude (auto mode)' },
  { key: 'Ctrl-b X', desc: 'Stop claude' },
  { key: 'Ctrl-b h', desc: 'Handoff session' },
  { key: 'Ctrl-b a', desc: 'Approval queue' },
  { key: 'Ctrl-b t', desc: 'Task queue' },
  { key: 'Ctrl-b x', desc: 'Close pane' },
  { key: 'Ctrl-b d', desc: 'Detach' },
  { key: 'Ctrl-b 0-9', desc: 'Switch to pane by index' },
  { key: 'Ctrl-b ?', desc: 'This help' },
];

export function Help({ onClose }: Props) {
  useInput((input, key) => {
    if (key.escape || input === 'q' || input === '?') {
      onClose();
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="green" paddingX={1}>
      <Text bold color="green">doubltmux Keybindings (Esc/q close)</Text>
      <Box flexDirection="column" marginTop={1}>
        {KEYBINDINGS.map((kb) => (
          <Box key={kb.key} flexDirection="row" gap={1}>
            <Text color="yellow" bold>{kb.key.padEnd(14)}</Text>
            <Text>{kb.desc}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
