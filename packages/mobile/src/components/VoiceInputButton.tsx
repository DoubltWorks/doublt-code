import React, { useState, useEffect, useRef } from 'react';
import { TouchableOpacity, Text, View, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VoiceService } from '../services/VoiceService';

interface Props {
  onVoiceResult: (text: string) => void;
  size?: number;
}

export function VoiceInputButton({ onVoiceResult, size = 64 }: Props) {
  const [isListening, setIsListening] = useState(false);
  const [partialText, setPartialText] = useState('');
  const voiceServiceRef = useRef<VoiceService | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const service = new VoiceService();
    voiceServiceRef.current = service;

    service.on('stateChanged', (state: string) => {
      setIsListening(state === 'listening');
    });

    service.on('result', (text: string) => {
      setPartialText('');
      onVoiceResult(text);
    });

    service.on('partialResult', (text: string) => {
      setPartialText(text);
    });

    return () => {
      service.destroy();
    };
  }, [onVoiceResult]);

  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.5, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [isListening, pulseAnim]);

  const handlePress = async () => {
    const service = voiceServiceRef.current;
    if (!service) return;
    if (isListening) {
      await service.stopListening();
    } else {
      await service.startListening();
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity: pulseAnim }}>
        <TouchableOpacity
          onPress={handlePress}
          style={[
            styles.button,
            { width: size, height: size, borderRadius: size / 2 },
            isListening ? styles.buttonListening : styles.buttonIdle,
          ]}
        >
          <Ionicons name={isListening ? 'ellipsis-horizontal' : 'mic'} size={18} color="#f8fafc" />
        </TouchableOpacity>
      </Animated.View>
      {isListening && partialText.length > 0 && (
        <Text style={styles.partialText}>{partialText}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  button: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonIdle: {
    backgroundColor: '#334155',
  },
  buttonListening: {
    backgroundColor: '#ef4444',
  },
  icon: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '600',
  },
  partialText: {
    color: '#f8fafc',
    marginTop: 8,
    fontSize: 13,
    maxWidth: 240,
    textAlign: 'center',
  },
});
