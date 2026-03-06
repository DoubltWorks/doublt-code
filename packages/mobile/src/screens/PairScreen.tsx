/**
 * PairScreen — Mobile device pairing screen.
 *
 * Users can pair with their PC by:
 * 1. Scanning the QR code shown on the PC (doublt Ctrl-b m)
 * 2. Manually entering the server address and pairing code
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  onConnect: (serverUrl: string, token: string) => void;
  connectionState: string;
  error?: string;
}

export function PairScreen({ onConnect, connectionState, error }: Props) {
  const insets = useSafeAreaInsets();
  const [host, setHost] = useState('');
  const [port, setPort] = useState('9800');
  const [code, setCode] = useState('');

  const handleConnect = () => {
    if (!host.trim() || !code.trim()) return;
    const serverUrl = `ws://${host.trim()}:${port.trim()}`;
    onConnect(serverUrl, code.trim());
  };

  const isConnecting = connectionState === 'connecting' || connectionState === 'reconnecting';

  return (
    <View style={styles.container}>
      <View style={[styles.content, { paddingTop: insets.top + 40 }]}>
        <Text style={styles.logo}>doublt</Text>
        <Text style={styles.subtitle}>Connect to your PC</Text>

        <Text style={styles.instruction}>
          Run "doublt start" on your PC, then press Ctrl-b m to get the pairing code.
        </Text>

        <View style={styles.form}>
          <Text style={styles.label}>Server Host</Text>
          <TextInput
            style={styles.input}
            value={host}
            onChangeText={setHost}
            placeholder="192.168.1.100"
            placeholderTextColor="#64748b"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          <Text style={styles.label}>Port</Text>
          <TextInput
            style={styles.input}
            value={port}
            onChangeText={setPort}
            placeholder="9800"
            placeholderTextColor="#64748b"
            keyboardType="number-pad"
          />

          <Text style={styles.label}>Pairing Code</Text>
          <TextInput
            style={[styles.input, styles.codeInput]}
            value={code}
            onChangeText={setCode}
            placeholder="ABC123"
            placeholderTextColor="#64748b"
            autoCapitalize="characters"
            maxLength={6}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.connectButton, isConnecting && styles.connectButtonDisabled]}
            onPress={handleConnect}
            disabled={isConnecting || !host.trim() || !code.trim()}
          >
            <Text style={styles.connectButtonText}>
              {isConnecting ? 'Connecting...' : 'Connect'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
  },
  logo: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#3b82f6',
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  subtitle: { fontSize: 16, color: '#94a3b8', marginBottom: 32 },
  instruction: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  form: { width: '100%' },
  label: { color: '#94a3b8', fontSize: 13, marginBottom: 6, marginLeft: 4 },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#f8fafc',
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  codeInput: {
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 8,
    fontFamily: 'monospace',
  },
  error: {
    color: '#ef4444',
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'center',
  },
  connectButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  connectButtonDisabled: { opacity: 0.5 },
  connectButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
