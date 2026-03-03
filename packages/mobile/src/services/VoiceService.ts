import { EventEmitter } from 'events';

export type VoiceState = 'idle' | 'listening' | 'processing' | 'error';

export class VoiceService extends EventEmitter {
  private state: VoiceState = 'idle';

  get currentState(): VoiceState { return this.state; }
  get isListening(): boolean { return this.state === 'listening'; }

  async startListening(): Promise<void> {
    // In production, would use @react-native-voice/voice
    this.state = 'listening';
    this.emit('stateChanged', this.state);
  }

  async stopListening(): Promise<void> {
    this.state = 'processing';
    this.emit('stateChanged', this.state);
    // Simulate processing
    this.state = 'idle';
    this.emit('stateChanged', this.state);
  }

  // Called when speech recognition returns results
  handleResult(text: string): void {
    this.emit('result', text);
  }

  // Called on partial results
  handlePartialResult(text: string): void {
    this.emit('partialResult', text);
  }

  handleError(error: string): void {
    this.state = 'error';
    this.emit('stateChanged', this.state);
    this.emit('error', error);
    this.state = 'idle';
    this.emit('stateChanged', this.state);
  }

  destroy(): void {
    this.removeAllListeners();
    this.state = 'idle';
  }
}
