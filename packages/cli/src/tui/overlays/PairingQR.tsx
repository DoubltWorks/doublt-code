import React from 'react';
import { Box, Text, useInput } from 'ink';

interface Props {
  pairingCode: string;
  pairingUrl: string;
  tunnelUrl?: string;
  onClose: () => void;
}

export function PairingQR({ pairingCode, pairingUrl, tunnelUrl, onClose }: Props) {
  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onClose();
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      <Text bold color="cyan">Mobile Pairing (Esc close)</Text>
      <Box flexDirection="column" marginTop={1} gap={1}>
        <Box flexDirection="row" gap={1}>
          <Text bold>Code:</Text>
          <Text color="yellow" bold>{pairingCode}</Text>
        </Box>
        <Box flexDirection="row" gap={1}>
          <Text bold>URL:</Text>
          <Text color="blue">{pairingUrl}</Text>
        </Box>
        {tunnelUrl && (
          <Box flexDirection="row" gap={1}>
            <Text bold>Tunnel:</Text>
            <Text color="cyan">{tunnelUrl}</Text>
          </Box>
        )}
        <Text dimColor>Enter this code in the doublt mobile app to pair.</Text>
      </Box>
    </Box>
  );
}
