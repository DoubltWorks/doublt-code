import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { SessionPane } from '../../cmux/SessionPane.js';

interface Props {
  panes: SessionPane[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}

export function SessionList({ panes, activeIndex, onSelect, onClose }: Props) {
  const [cursor, setCursor] = useState(activeIndex);

  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onClose();
      return;
    }
    if (input === 'j' || key.downArrow) {
      setCursor(prev => Math.min(prev + 1, panes.length - 1));
      return;
    }
    if (input === 'k' || key.upArrow) {
      setCursor(prev => Math.max(prev - 1, 0));
      return;
    }
    if (key.return) {
      onSelect(cursor);
      onClose();
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="blue" paddingX={1}>
      <Text bold color="blue">Sessions (j/k navigate, Enter select, Esc close)</Text>
      <Box flexDirection="column" marginTop={1}>
        {panes.map((pane, i) => {
          const info = pane.getSessionInfo();
          const name = info ? `${info.index}: ${info.name}` : pane.sessionId.slice(0, 12);
          const status = info?.status ?? 'unknown';
          const isCursor = i === cursor;

          return (
            <Box key={pane.id} flexDirection="row" gap={1}>
              <Text color={isCursor ? 'blue' : undefined} bold={isCursor} inverse={isCursor}>
                {isCursor ? '>' : ' '} {name}
              </Text>
              <Text dimColor>[{status}]</Text>
              {i === activeIndex && <Text color="green">*</Text>}
            </Box>
          );
        })}
        {panes.length === 0 && (
          <Text dimColor>No sessions. Press Ctrl-b c to create one.</Text>
        )}
      </Box>
    </Box>
  );
}
