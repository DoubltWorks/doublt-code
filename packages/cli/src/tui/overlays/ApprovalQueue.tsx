import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface ApprovalItem {
  id: string;
  toolName: string;
  sessionId: string;
  description?: string;
}

interface Props {
  items: ApprovalItem[];
  onDecide: (id: string, approved: boolean) => void;
  onClose: () => void;
}

export function ApprovalQueue({ items, onDecide, onClose }: Props) {
  const [cursor, setCursor] = useState(0);

  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onClose();
      return;
    }
    if (input === 'j' || key.downArrow) {
      setCursor(prev => Math.min(prev + 1, items.length - 1));
      return;
    }
    if (input === 'k' || key.upArrow) {
      setCursor(prev => Math.max(prev - 1, 0));
      return;
    }
    if (input === 'y' && items[cursor]) {
      onDecide(items[cursor].id, true);
      return;
    }
    if (input === 'n' && items[cursor]) {
      onDecide(items[cursor].id, false);
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1}>
      <Text bold color="yellow">Approval Queue (y approve, n reject, Esc close)</Text>
      <Box flexDirection="column" marginTop={1}>
        {items.map((item, i) => {
          const isCursor = i === cursor;
          return (
            <Box key={item.id} flexDirection="row" gap={1}>
              <Text color={isCursor ? 'yellow' : undefined} bold={isCursor} inverse={isCursor}>
                {isCursor ? '>' : ' '} {item.toolName}
              </Text>
              <Text dimColor>{item.description ?? ''}</Text>
            </Box>
          );
        })}
        {items.length === 0 && (
          <Text dimColor>No pending approvals.</Text>
        )}
      </Box>
    </Box>
  );
}
