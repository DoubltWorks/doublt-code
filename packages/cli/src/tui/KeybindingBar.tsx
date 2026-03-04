import React from 'react';
import { Box, Text } from 'ink';

interface Props {
  prefixMode: boolean;
}

const NORMAL_HINTS = [
  { key: '^b', desc: 'prefix' },
];

const PREFIX_HINTS = [
  { key: 'c', desc: 'new' },
  { key: 'n', desc: 'next' },
  { key: 'p', desc: 'prev' },
  { key: 'w', desc: 'list' },
  { key: 'C', desc: 'claude' },
  { key: 'h', desc: 'handoff' },
  { key: 'm', desc: 'pair' },
  { key: 'd', desc: 'detach' },
  { key: '?', desc: 'help' },
];

export function KeybindingBar({ prefixMode }: Props) {
  const hints = prefixMode ? PREFIX_HINTS : NORMAL_HINTS;

  return (
    <Box flexDirection="row" gap={1} width="100%">
      {hints.map((hint) => (
        <Box key={hint.key} flexDirection="row">
          <Text color="yellow" bold>{hint.key}</Text>
          <Text dimColor>:{hint.desc}</Text>
        </Box>
      ))}
      {prefixMode && (
        <Box marginLeft={1}>
          <Text color="yellow">-- PREFIX --</Text>
        </Box>
      )}
    </Box>
  );
}
