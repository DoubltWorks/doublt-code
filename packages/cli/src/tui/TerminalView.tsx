import React from 'react';
import { Box, Text } from 'ink';

interface Props {
  lines: string[];
  height: number;
}

export function TerminalView({ lines, height }: Props) {
  const visibleLines = lines.slice(-height);

  return (
    <Box flexDirection="column" flexGrow={1}>
      {visibleLines.map((line, i) => (
        <Text key={i}>{line}</Text>
      ))}
      {visibleLines.length === 0 && (
        <Text dimColor>Waiting for output...</Text>
      )}
    </Box>
  );
}
