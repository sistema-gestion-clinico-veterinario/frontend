import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { RealtimeStompConnection, RealtimeStompService } from './realtime-stomp.service';
import { RealtimeTicketService } from './realtime-ticket.service';

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readyState = FakeWebSocket.CONNECTING;
  sent: string[] = [];
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }

  receive(data: string): void {
    this.onmessage?.({ data } as MessageEvent);
  }

  close(code = 1000, reason = ''): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.({ code, reason } as CloseEvent);
  }

  serverClose(code = 1006): void {
    this.close(code, 'Server closed');
  }
}

describe('RealtimeStompService', () => {
  let service: RealtimeStompService;
  let ticketService: jasmine.SpyObj<RealtimeTicketService>;
  let connection: RealtimeStompConnection | null;
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    jasmine.clock().install();
    FakeWebSocket.instances = [];
    originalWebSocket = globalThis.WebSocket;
    Object.defineProperty(globalThis, 'WebSocket', {
      configurable: true,
      writable: true,
      value: FakeWebSocket
    });

    ticketService = jasmine.createSpyObj<RealtimeTicketService>('RealtimeTicketService', ['issue']);
    ticketService.issue.and.returnValue(of({
      success: true,
      message: 'Ticket emitido',
      data: { ticket: 'one-time-ticket' }
    }));

    TestBed.configureTestingModule({
      providers: [
        RealtimeStompService,
        { provide: RealtimeTicketService, useValue: ticketService }
      ]
    });
    service = TestBed.inject(RealtimeStompService);
    connection = null;
  });

  afterEach(() => {
    connection?.disconnect();
    Object.defineProperty(globalThis, 'WebSocket', {
      configurable: true,
      writable: true,
      value: originalWebSocket
    });
    jasmine.clock().uninstall();
  });

  it('mantiene la conexión enviando el heartbeat STOMP negociado', () => {
    connection = service.connect('/topic/caja/1', () => undefined, { label: 'Test' });
    const socket = FakeWebSocket.instances[0];

    expect(socket.url).toContain('/api/v1/ws');
    expect(socket.url).not.toContain('/ws/websocket');
    socket.open();
    expect(socket.sent[0]).toContain('heart-beat:10000,10000');

    socket.receive('CONNECTED\nversion:1.2\nheart-beat:10000,10000\n\n\0');
    expect(connection.isConnected()).toBeTrue();
    expect(socket.sent.some(frame => frame.includes('destination:/topic/caja/1'))).toBeTrue();

    jasmine.clock().tick(10_001);
    expect(socket.sent.filter(frame => frame === '\n').length).toBe(1);
  });

  it('obtiene un ticket nuevo con espera progresiva después de un cierre inesperado', () => {
    spyOn(Math, 'random').and.returnValue(0);
    connection = service.connect('/topic/caja/1', () => undefined, { label: 'Test' });
    const firstSocket = FakeWebSocket.instances[0];
    firstSocket.open();
    firstSocket.receive('CONNECTED\nversion:1.2\nheart-beat:10000,10000\n\n\0');

    firstSocket.serverClose();
    jasmine.clock().tick(4_999);
    expect(ticketService.issue).toHaveBeenCalledTimes(1);

    jasmine.clock().tick(1);
    expect(ticketService.issue).toHaveBeenCalledTimes(2);
    expect(FakeWebSocket.instances.length).toBe(2);
  });

  it('no vuelve a conectar después de destruir la conexión', () => {
    spyOn(Math, 'random').and.returnValue(0);
    connection = service.connect('/topic/caja/1', () => undefined, { label: 'Test' });
    const socket = FakeWebSocket.instances[0];
    socket.open();
    socket.receive('CONNECTED\nversion:1.2\nheart-beat:10000,10000\n\n\0');
    socket.serverClose();

    connection.disconnect();
    jasmine.clock().tick(60_000);
    expect(ticketService.issue).toHaveBeenCalledTimes(1);
  });
});
