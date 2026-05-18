import { Component, OnInit, OnDestroy, inject, signal, computed, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { Toast } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { AuditLogService, AuditLog } from '../../../core/services/audit-log.service';
import { CompanyService } from '../../../core/services/company.service';
import { AuthStore } from '../../../store/auth.store';
import { CompanyListResponse } from '../../../models/response/company-list-response';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-auditoria',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    Toast
  ],
  providers: [MessageService],
  templateUrl: './auditoria.component.html',
  styleUrl: './auditoria.component.scss'
})
export class AuditoriaComponent implements OnInit, OnDestroy {
  private readonly auditLogService = inject(AuditLogService);
  private readonly companyService = inject(CompanyService);
  private readonly messageService = inject(MessageService);
  readonly authStore = inject(AuthStore);

  private stompClient: LightweightStompClient | null = null;
  private lastSubscribedDestination: string | null = null;
  private loadTimeout: any = null;

  readonly isSuperAdmin = computed(() =>
    (this.authStore.roles() ?? []).some(r => r === 'ROLE_SUPER_ADMIN' || r === 'SUPER_ADMIN')
  );

  logs = signal<AuditLog[]>([]);
  totalRecords = signal<number>(0);
  loading = signal<boolean>(false);
  companies = signal<CompanyListResponse[]>([]);

  // Filtros
  selectedCompanyId: number | null = null;
  userEmailFilter: string = '';
  actionFilter: string = '';
  moduleFilter: string = '';
  startDateFilter: string = '';
  endDateFilter: string = '';

  // Paginación actual
  first = 0;
  rows = 10;

  modulesList = [
    'Seguridad', 'Citas', 'Mascotas', 'Usuarios', 
    'Clientes', 'Facturación', 'Consultas', 'Horarios', 'Empleados'
  ];
  
  actionsList = [
    'LOGIN_EXITOSO', 'CAMBIO_ROL', 'CAMBIO_CONTRASENA', 'RESET_CONTRASENA', 
    'SUSPENSION_CUENTA', 'CONSULTA_AUDITORIA', 'CREAR_EMPLEADO', 'ACTUALIZAR_EMPLEADO', 
    'ACTIVAR_EMPLEADO', 'DESACTIVAR_EMPLEADO', 'ELIMINAR_EMPLEADO', 'ASIGNAR_HORARIOS_MASIVO', 
    'CLONAR_HORARIOS_SEMANA', 'CLONAR_HORARIOS_DIA', 'ELIMINAR_HORARIOS_MASIVO', 
    'REGISTRAR_MASCOTA', 'ACTUALIZAR_MASCOTA', 'ACTIVAR_MASCOTA', 'DESACTIVAR_MASCOTA', 
    'CREAR_APODERADO', 'ACTUALIZAR_APODERADO', 'ACTIVAR_APODERADO', 'DESACTIVAR_APODERADO', 
    'ELIMINAR_APODERADO', 'CREAR_CITA', 'REPROGRAMAR_CITA', 'CANCELAR_CITA', 
    'ELIMINAR_CITA', 'INICIAR_ATENCION', 'ACTUALIZAR_CONSULTA', 'CERRAR_CONSULTA', 
    'REGISTRAR_PAGO'
  ];

  constructor() {
    effect(() => {
      // Registrar dependencia del signal reactivamente
      const enterprise = this.authStore.selectedEnterprise();
      const compId = this.authStore.companyId();
      
      untracked(() => {
        this.first = 0;
        this.loadLogs();
      });
    });
  }

  ngOnInit() {
    if (this.isSuperAdmin()) {
      this.companyService.listar(0, 1000).subscribe({
        next: (res) => {
          this.companies.set(res.data.content || []);
        }
      });
    }
  }

  ngOnDestroy() {
    if (this.stompClient) {
      this.stompClient.disconnect();
    }
  }

  setupWebSocket(targetCompanyId: number | undefined) {
    const destination = targetCompanyId 
      ? `/topic/audit-logs/${targetCompanyId}`
      : '/topic/audit-logs';

    // Evitar reconexiones si ya estamos escuchando o conectando al mismo destino y está activo
    if (this.lastSubscribedDestination === destination && this.stompClient && this.stompClient.isConnected()) {
      return;
    }

    if (this.stompClient) {
      this.stompClient.disconnect();
    }

    this.lastSubscribedDestination = destination;

    try {
      const urlObj = new URL(environment.apiUrl);
      const wsProtocol = urlObj.protocol === 'https:' ? 'wss:' : 'ws:';
      
      // Obtener el context-path de forma dinámica (ej: '/api/v1')
      let path = urlObj.pathname.trim();
      if (path.endsWith('/')) {
        path = path.substring(0, path.length - 1);
      }
      const wsUrl = `${wsProtocol}//${urlObj.host}${path}/ws/websocket`;

      this.stompClient = new LightweightStompClient(wsUrl);

      this.stompClient.connect(
        () => {
          this.stompClient?.subscribe(destination, (newLog: AuditLog) => {
            // Incorporar el log en tiempo real al principio de la tabla si el usuario está en la página 0
            if (this.first === 0) {
              this.logs.update(current => {
                if (current.some(l => l.id === newLog.id)) return current;
                return [newLog, ...current.slice(0, this.rows - 1)];
              });
              this.totalRecords.update(total => total + 1);
            } else {
              this.totalRecords.update(total => total + 1);
            }
          });
        },
        (err) => {
          console.error('WebSocket Error:', err);
        }
      );
    } catch (e) {
      console.error('WebSocket Initialization Error:', e);
    }
  }

  loadLogs(event: any = null) {
    if (event) {
      this.first = event.first ?? 0;
      this.rows = event.rows ?? 10;
    }

    if (this.loadTimeout) {
      clearTimeout(this.loadTimeout);
    }

    this.loadTimeout = setTimeout(() => {
      this.executeLoadLogs();
    }, 50);
  }

  private executeLoadLogs() {
    const page = this.first / this.rows;
    this.loading.set(true);

    const formattedStart = this.startDateFilter ? `${this.startDateFilter}T00:00:00` : undefined;
    const formattedEnd = this.endDateFilter ? `${this.endDateFilter}T23:59:59` : undefined;

    // Determinar la empresa meta:
    // Si es super admin y tiene un filtro de empresa local, usamos ese.
    // Si es super admin y el filtro es "Todas las clínicas" (null), pasamos undefined para ver todo.
    // Si no es super admin, forzamos el companyId de su sesión.
    let targetCompanyId: number | undefined = undefined;
    if (this.isSuperAdmin()) {
      targetCompanyId = this.selectedCompanyId || undefined;
    } else {
      targetCompanyId = this.authStore.companyId() || undefined;
    }

    this.auditLogService.getLogs({
      companyId: targetCompanyId,
      userEmail: this.userEmailFilter.trim() || undefined,
      action: this.actionFilter || undefined,
      module: this.moduleFilter || undefined,
      startDate: formattedStart,
      endDate: formattedEnd,
      page: page,
      size: this.rows,
      sort: 'timestamp,desc'
    }).subscribe({
      next: (res) => {
        this.logs.set(res.data.content);
        this.totalRecords.set(res.data.totalElements);
        this.loading.set(false);

        // Configurar/actualizar el canal WebSocket reactivamente tras cargar los registros iniciales exitosamente
        this.setupWebSocket(targetCompanyId);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron obtener los registros de auditoría' });
        this.loading.set(false);
      }
    });
  }

  applyFilters() {
    this.first = 0;
    this.loadLogs();
  }

  clearFilters() {
    this.selectedCompanyId = null;
    this.userEmailFilter = '';
    this.actionFilter = '';
    this.moduleFilter = '';
    this.startDateFilter = '';
    this.endDateFilter = '';
    this.applyFilters();
  }

  getActionBadgeClass(action: string): string {
    switch (action) {
      case 'LOGIN_EXITOSO':
        return 'bg-teal-50 border-teal-200 text-teal-700';
      case 'CONSULTA_AUDITORIA':
        return 'bg-violet-50 border-violet-200 text-violet-700';
      case 'SUSPENSION_CUENTA':
        return 'bg-rose-50 border-rose-200 text-rose-700';
      case 'CAMBIO_ROL':
        return 'bg-blue-50 border-blue-200 text-blue-700';
      case 'CAMBIO_CONTRASENA':
      case 'RESET_CONTRASENA':
        return 'bg-indigo-50 border-indigo-200 text-indigo-700';
      case 'CREAR_CITA':
      case 'REGISTRAR_MASCOTA':
      case 'CREAR_APODERADO':
      case 'CREAR_EMPLEADO':
        return 'bg-emerald-50 border-emerald-200 text-emerald-700';
      case 'ACTUALIZAR_CITA':
      case 'REPROGRAMAR_CITA':
      case 'ACTUALIZAR_MASCOTA':
      case 'ACTUALIZAR_APODERADO':
      case 'ACTUALIZAR_EMPLEADO':
      case 'ACTUALIZAR_CONSULTA':
        return 'bg-amber-50 border-amber-200 text-amber-700';
      case 'ACTIVAR_MASCOTA':
      case 'ACTIVAR_APODERADO':
      case 'ACTIVAR_EMPLEADO':
      case 'ASIGNAR_HORARIOS_MASIVO':
      case 'CLONAR_HORARIOS_SEMANA':
      case 'CLONAR_HORARIOS_DIA':
      case 'REGISTRAR_PAGO':
        return 'bg-cyan-50 border-cyan-200 text-cyan-700';
      case 'DESACTIVAR_MASCOTA':
      case 'DESACTIVAR_APODERADO':
      case 'DESACTIVAR_EMPLEADO':
      case 'ELIMINAR_CITA':
      case 'ELIMINAR_APODERADO':
      case 'ELIMINAR_EMPLEADO':
      case 'ELIMINAR_HORARIOS_MASIVO':
      case 'CANCELAR_CITA':
        return 'bg-red-50 border-red-200 text-red-700';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-700';
    }
  }

  getModuleBadgeClass(module: string): string {
    switch (module) {
      case 'Seguridad':
        return 'bg-red-50 border-red-200 text-red-700';
      case 'Citas':
        return 'bg-sky-50 border-sky-200 text-sky-700';
      case 'Mascotas':
        return 'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700';
      case 'Clientes':
        return 'bg-purple-50 border-purple-200 text-purple-700';
      case 'Facturación':
        return 'bg-green-50 border-green-200 text-green-700';
      case 'Consultas':
        return 'bg-indigo-50 border-indigo-200 text-indigo-700';
      case 'Horarios':
      case 'Empleados':
        return 'bg-orange-50 border-orange-200 text-orange-700';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-700';
    }
  }
}

class LightweightStompClient {
  private socket: WebSocket | null = null;
  private connected = false;
  private subscriptions = new Map<string, (payload: any) => void>();
  private subIdCounter = 0;

  constructor(private url: string) {}

  isConnected(): boolean {
    return this.connected;
  }

  connect(onConnect: () => void, onError: (err: any) => void) {
    try {
      console.log('🔌 Conectando al WebSocket de auditoría...', this.url);
      this.socket = new WebSocket(this.url);

      this.socket.onopen = () => {
        const connectFrame = `CONNECT\naccept-version:1.1,1.2\nheart-beat:10000,10000\n\n\0`;
        this.socket?.send(connectFrame);
      };

      this.socket.onmessage = (event) => {
        let data = event.data as string;
        if (!data || data === '\n' || data === '\r\n') return; // Heartbeat check

        // Normalizar saltos de línea Windows/Linux a \n
        data = data.replace(/\r\n/g, '\n');

        if (data.startsWith('CONNECTED')) {
          this.connected = true;
          console.log('✅ WebSocket de auditoría conectado exitosamente!');
          onConnect();
          this.subscriptions.forEach((callback, dest) => {
            this.sendSubscribeFrame(dest);
          });
        } else if (data.startsWith('MESSAGE')) {
          const bodyStart = data.indexOf('\n\n');
          if (bodyStart !== -1) {
            const body = data.substring(bodyStart + 2, data.lastIndexOf('\0')).trim();
            try {
              const parsed = JSON.parse(body);
              console.log('📥 Mensaje de auditoría recibido en tiempo real:', parsed);
              const destMatch = data.match(/destination:([^\n]+)/);
              if (destMatch) {
                const destination = destMatch[1].trim();
                const callback = this.subscriptions.get(destination);
                if (callback) {
                  callback(parsed);
                }
              }
            } catch (e) {
              console.error('Failed to parse STOMP message body', e);
            }
          }
        }
      };

      this.socket.onerror = (err) => {
        console.error('❌ Error en el WebSocket de auditoría:', err);
        onError(err);
      };

      this.socket.onclose = () => {
        console.log('🔌 WebSocket de auditoría cerrado.');
        this.connected = false;
        // Intentar reconectar si la desconexión no fue manual
        if (this.socket) {
          setTimeout(() => {
            if (this.socket && !this.connected) {
              console.log('🔄 Intentando reconectar WebSocket de auditoría...');
              this.connect(onConnect, onError);
            }
          }, 5000);
        }
      };
    } catch (e) {
      onError(e);
    }
  }

  subscribe(destination: string, callback: (payload: any) => void) {
    this.subscriptions.set(destination, callback);
    if (this.connected) {
      this.sendSubscribeFrame(destination);
    }
  }

  private sendSubscribeFrame(destination: string) {
    const subFrame = `SUBSCRIBE\nid:sub-${this.subIdCounter++}\ndestination:${destination}\n\n\0`;
    this.socket?.send(subFrame);
  }

  disconnect() {
    this.connected = false;
    this.subscriptions.clear();
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.onmessage = null;
      this.socket.onopen = null;
      this.socket.close();
      this.socket = null;
    }
  }
}
