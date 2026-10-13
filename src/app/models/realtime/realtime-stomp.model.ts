export interface RealtimeStompConnection {
  disconnect(): void;
  isConnected(): boolean;
  isActive(): boolean;
}

export interface RealtimeStompOptions {
  label?: string;
  heartbeatMs?: number;
  initialReconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
}
