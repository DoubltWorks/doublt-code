import React from 'react';
import { Box, Text } from 'ink';
import type { SessionPane } from '../cmux/SessionPane.js';

interface Props {
  panes: SessionPane[];
  activeIndex: number;
  connectionState: string;
  tunnelUrl?: string;
  prefixMode: boolean;
}

export function StatusBar({ panes, activeIndex, connectionState, tunnelUrl, prefixMode }: Props) {
  return (
    <Box flexDirection="row" width="100%">
      <Box flexGrow={1} flexDirection="row" gap={1}>
        {panes.map((pane, i) => {
          const info = pane.getSessionInfo();
          const name = info ? `${info.index}:${info.name}` : pane.sessionId.slice(0, 8);
          const isActive = i === activeIndex;

          return (
            <Text
              key={pane.id}
              bold={isActive}
              color={isActive ? 'blue' : 'gray'}
              inverse={isActive}
            >
              {` ${name} `}
            </Text>
          );
        })}
        {panes.length === 0 && (
          <Text dimColor>No sessions</Text>
        )}
      </Box>
      <Box gap={1}>
        {prefixMode && (
          <Text color="yellow" bold> ^b </Text>
        )}
        {tunnelUrl && (
          <Text color="cyan" dimColor>{tunnelUrl}</Text>
        )}
        <Text color={connectionState === 'connected' ? 'green' : 'red'}>
          {connectionState === 'connected' ? 'OK' : connectionState}
        </Text>
        <Text dimColor>doublt</Text>
      </Box>
    </Box>
  );
}
