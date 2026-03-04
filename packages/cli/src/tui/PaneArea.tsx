import React from 'react';
import { Box, Text } from 'ink';
import { TerminalView } from './TerminalView.js';
import type { SessionPane } from '../cmux/SessionPane.js';

interface Props {
  activePane: SessionPane | undefined;
  terminalLines: string[];
  height: number;
}

export function PaneArea({ activePane, terminalLines, height }: Props) {
  if (!activePane) {
    return (
      <Box flexGrow={1} justifyContent="center" alignItems="center">
        <Text dimColor>No active session. Press Ctrl-b c to create one.</Text>
      </Box>
    );
  }

  const info = activePane.getSessionInfo();

  return (
    <Box flexDirection="column" flexGrow={1}>
      {info && (
        <Box flexDirection="row" gap={1} paddingX={1}>
          <Text color="blue" bold>{info.name}</Text>
          <Text dimColor>[{info.status}]</Text>
          <Text dimColor>{info.cwd}</Text>
          <Text color={info.contextUsage >= 0.85 ? 'red' : info.contextUsage >= 0.6 ? 'yellow' : 'green'}>
            {Math.round(info.contextUsage * 100)}%
          </Text>
        </Box>
      )}
      <TerminalView lines={terminalLines} height={Math.max(1, height - 1)} />
    </Box>
  );
}
