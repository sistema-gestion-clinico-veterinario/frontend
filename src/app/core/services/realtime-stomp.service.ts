import { Injectable, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RealtimeTicketService } from './realtime-ticket.service';

export interface RealtimeStompConnection {
  disconnect(): void;
  isConnected(): boolean;
  isActive(): boolean;
}

interface RealtimeStompOptions {
  label?: string;
  heartbeatMs?: number;
  initialReconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
}

@Injectable({ providedIn: 'root' })
export class RealtimeStompService {
  private readonly ticketService = inject(RealtimeTicketService);

  connect<T>(
    destination: string,
    onMessage: (payload: T) => void,
    options: RealtimeStompOptions = {}
  ): RealtimeStompConnection {
    const connection = new ManagedStompConnection<T>(
      this.ticketService,
      this.websocketUrl(),
      destination,
      onMessage,
      options
    );
    connection.start();
    return connection;
  }

  private websocketUrl(): string {
    const url = new URL(environment.wsApiUrl);
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const path = url.pathname.replace(/\/$/, '');
    // Se usa el endpoint WebSocket nativo registrado por Spring. La ruta
    // `/ws/websocket` pertenece al transporte SockJS y requiere su framing.
    return `${protocol}//${url.host}${path}/ws`;
  }
}

class ManagedStompConnection<T> implements RealtimeStompConnection {
  private readonly label: string;
  private readonly heartbeatMs: number;
  private readonly initialReconnectDelayMs: number;
  private readonly maxReconnectDelayMs: number;

  private socket: WebSocket | null = null;
  private ticketRequest: Subscription | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private outgoingHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private incomingHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private connected = false;
  private connecting = false;
  private stopped = false;
  private reconnectAttempt = 0;
  private lastServerActivity = 0;

  private readonly onlineHandler = () => {
    if (this.stopped || this.connected || this.connecting) return;
    this.clearReconnectTimer();
    this.connectNow();
  };

  constructor(
    private readonly ticketService: RealtimeTicketService,
    private readonly url: string,
    private readonly destination: string,
    private readonly onMessage: (payload: T) => void,
    options: RealtimeStompOptions
  ) {
    this.label = options.label ?? 'Realtime';
    this.heartbeatMs = options.heartbeatMs ?? 10_000;
    this.initialReconnectDelayMs = options.initialReconnectDelayMs ?? 5_000;
    this.maxReconnectDelayMs = options.maxReconnectDelayMs ?? 60_000;
  }

  start(): void {
    if (this.stopped) return;
    window.addEventListener('online', this.onlineHandler);
    this.connectNow();
  }

  isConnected(): boolean {
    return this.connected;
  }

  isActive(): boolean {
    return !this.stopped && (this.connected || this.connecting || this.reconnectTimer !== null);
  }

  disconnect(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.connected = false;
    this.connecting = false;
    window.removeEventListener('online', this.onlineHandler);
    this.ticketRequest?.unsubscribe();
    this.ticketRequest = null;
    this.clearReconnectTimer();
    this.clearHeartbeatTimers();

    const socket = this.socket;
    this.socket = null;
    if (!socket) return;

    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(`DISCONNECT\nreceipt:disconnect-${Date.now()}\n\n\0`);
    }
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close(1000, 'Component destroyed');
    }
  }

  private connectNow(): void {
    if (this.stopped || this.connected || this.connecting) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.scheduleReconnect();
      return;
    }

    this.connecting = true;
    this.ticketRequest?.unsubscribe();
    this.ticketRequest = this.ticketService.issue().subscribe({
      next: ({ data }) => {
        this.ticketRequest = null;
        if (this.stopped) return;
        if (!data?.ticket) {
          this.connecting = false;
          this.scheduleReconnect();
          return;
        }
        this.openSocket(data.ticket);
      },
      error: error => {
        this.ticketRequest = null;
        this.connecting = false;
        if (!this.stopped) {
          console.warn(`[${this.label} WS] No se pudo obtener el ticket`, error);
          this.scheduleReconnect();
        }
      }
    });
  }

  private openSocket(ticket: string): void {
    try {
      const socket = new WebSocket(this.url);
      this.socket = socket;
      this.lastServerActivity = Date.now();

      socket.onopen = () => {
        if (this.stopped || socket !== this.socket) return;
        socket.send(
          `CONNECT\naccept-version:1.2,1.1\nheart-beat:${this.heartbeatMs},${this.heartbeatMs}\nticket:${ticket}\n\n\0`
        );
      };

      socket.onmessage = event => {
        if (this.stopped || socket !== this.socket) return;
        this.lastServerActivity = Date.now();
        this.handleFrames(String(event.data));
      };

      socket.onerror = error => {
        if (!this.stopped && socket === this.socket) {
          console.warn(`[${this.label} WS] Error de transporte`, error);
        }
      };

      socket.onclose = event => {
        if (socket !== this.socket) return;
        this.socket = null;
        this.connected = false;
        this.connecting = false;
        this.clearHeartbeatTimers();
        if (!this.stopped) {
          console.warn(`[${this.label} WS] Conexión cerrada (${event.code})`);
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      this.socket = null;
      this.connected = false;
      this.connecting = false;
      if (!this.stopped) {
        console.warn(`[${this.label} WS] No se pudo abrir la conexión`, error);
        this.scheduleReconnect();
      }
    }
  }

  private handleFrames(rawData: string): void {
    const normalized = rawData.replace(/\r\n/g, '\n');
    for (const rawFrame of normalized.split('\0')) {
      const frame = rawFrame.replace(/^\n+/, '');
      if (!frame.trim()) continue;

      if (frame.startsWith('CONNECTED')) {
        this.connected = true;
        this.connecting = false;
        this.reconnectAttempt = 0;
        this.startHeartbeatTimers(frame);
        this.sendSubscribeFrame();
        continue;
      }

      if (frame.startsWith('MESSAGE')) {
        this.handleMessageFrame(frame);
        continue;
      }

      if (frame.startsWith('ERROR')) {
        console.error(`[${this.label} WS] El servidor rechazó la conexión`, frame);
        this.socket?.close(1008, 'STOMP error');
      }
    }
  }

  private handleMessageFrame(frame: string): void {
    const bodyStart = frame.indexOf('\n\n');
    const destination = frame.match(/(?:^|\n)destination:([^\n]+)/)?.[1]?.trim();
    if (bodyStart < 0 || destination !== this.destination) return;

    try {
      this.onMessage(JSON.parse(frame.substring(bodyStart + 2).trim()) as T);
    } catch (error) {
      console.error(`[${this.label} WS] Mensaje inválido`, error);
    }
  }

  private sendSubscribeFrame(): void {
    if (!this.connected || this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(
      `SUBSCRIBE\nid:sub-${Date.now()}\ndestination:${this.destination}\nack:auto\n\n\0`
    );
  }

  private startHeartbeatTimers(connectedFrame: string): void {
    this.clearHeartbeatTimers();
    const serverHeartbeat = connectedFrame.match(/(?:^|\n)heart-beat:(\d+),(\d+)/);
    const serverCanSend = Number(serverHeartbeat?.[1] ?? 0);
    const serverWantsReceive = Number(serverHeartbeat?.[2] ?? 0);
    const outgoingInterval = this.negotiatedInterval(this.heartbeatMs, serverWantsReceive);
    const incomingInterval = this.negotiatedInterval(this.heartbeatMs, serverCanSend);

    if (outgoingInterval > 0) {
      this.outgoingHeartbeatTimer = setInterval(() => {
        if (this.socket?.readyState === WebSocket.OPEN) this.socket.send('\n');
      }, outgoingInterval);
    }

    if (incomingInterval > 0) {
      const tolerance = incomingInterval * 2.5;
      this.incomingHeartbeatTimer = setInterval(() => {
        if (Date.now() - this.lastServerActivity > tolerance) {
          console.warn(`[${this.label} WS] Heartbeat del servidor agotado`);
          this.socket?.close(4000, 'Heartbeat timeout');
        }
      }, incomingInterval);
    }
  }

  private negotiatedInterval(localValue: number, remoteValue: number): number {
    if (localValue <= 0 || remoteValue <= 0) return 0;
    return Math.max(localValue, remoteValue);
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer !== null) return;
    const exponentialDelay = Math.min(
      this.initialReconnectDelayMs * 2 ** this.reconnectAttempt,
      this.maxReconnectDelayMs
    );
    const jitter = Math.floor(exponentialDelay * Math.random() * 0.2);
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectNow();
    }, exponentialDelay + jitter);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer === null) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private clearHeartbeatTimers(): void {
    if (this.outgoingHeartbeatTimer !== null) clearInterval(this.outgoingHeartbeatTimer);
    if (this.incomingHeartbeatTimer !== null) clearInterval(this.incomingHeartbeatTimer);
    this.outgoingHeartbeatTimer = null;
    this.incomingHeartbeatTimer = null;
  }
}
