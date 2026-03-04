import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { WorkspaceListItem } from '@doublt/shared';

interface Props {
  workspaces: WorkspaceListItem[];
  onSelect: (workspaceId: string) => void;
  onClose: () => void;
}

export function WorkspaceList({ workspaces, onSelect, onClose }: Props) {
  const [cursor, setCursor] = useState(0);

  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onClose();
      return;
    }
    if (input === 'j' || key.downArrow) {
      setCursor(prev => Math.min(prev + 1, workspaces.length - 1));
      return;
    }
    if (input === 'k' || key.upArrow) {
      setCursor(prev => Math.max(prev - 1, 0));
      return;
    }
    if (key.return && workspaces[cursor]) {
      onSelect(workspaces[cursor].id);
      onClose();
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      <Text bold color="cyan">Workspaces (j/k navigate, Enter select, Esc close)</Text>
      <Box flexDirection="column" marginTop={1}>
        {workspaces.map((ws, i) => {
          const isCursor = i === cursor;
          return (
            <Box key={ws.id} flexDirection="row" gap={1}>
              <Text color={isCursor ? 'cyan' : undefined} bold={isCursor} inverse={isCursor}>
                {isCursor ? '>' : ' '} {ws.index}: {ws.name}
              </Text>
              <Text dimColor>[{ws.status}]</Text>
              <Text dimColor>{ws.sessionCount} sessions</Text>
            </Box>
          );
        })}
        {workspaces.length === 0 && (
          <Text dimColor>No workspaces.</Text>
        )}
      </Box>
    </Box>
  );
}
