import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  connectionState: string;
  currentScreen: string;
}

export function ConnectionBanner({ connectionState, currentScreen }: Props) {
  const insets = useSafeAreaInsets();
  // Don't show on pair screen (user already sees connection state there)
  if (currentScreen === 'pair') return null;
  if (connectionState === 'connected' || connectionState === 'connecting') return null;

  const isReconnecting = connectionState === 'reconnecting';

  return (
    <View style={[styles.banner, { top: insets.top }, isReconnecting ? styles.reconnecting : styles.disconnected]}>
      <Text style={styles.text}>
        {isReconnecting ? 'Reconnecting...' : 'Disconnected'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0, // overridden by inline style using insets.top
    left: 0,
    right: 0,
    paddingVertical: 6,
    alignItems: 'center',
    zIndex: 999,
  },
  reconnecting: {
    backgroundColor: '#f59e0b',
  },
  disconnected: {
    backgroundColor: '#ef4444',
  },
  text: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
