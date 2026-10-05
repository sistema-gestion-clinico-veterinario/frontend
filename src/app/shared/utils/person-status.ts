import { ApoderadoEstadoResponse, TipoInactividad } from '../../models/response/apoderado-estado-response';
import { CitaResponse } from '../../models/response/cita-response';

export type PersonStatusAction = 'SUSPENSION' | 'BAJA' | 'REACTIVAR';

interface PersonStatus {
  activo: boolean;
  tipoInactividad?: TipoInactividad | null;
}

/** Cuerpo del cambio de estado: solo viaja lo que se indicó. */
export function cuerpoDeEstado(opciones: { tipo?: TipoInactividad; reason?: string }): { tipo?: TipoInactividad; reason?: string } {
  const cuerpo: { tipo?: TipoInactividad; reason?: string } = {};
  if (opciones.tipo) cuerpo.tipo = opciones.tipo;
  if (opciones.reason) cuerpo.reason = opciones.reason;
  return cuerpo;
}

export function personStatusLabel(person: PersonStatus): string {
  if (person.activo) return 'Activo';
  return person.tipoInactividad === 'SUSPENSION' ? 'Suspendido' : 'De baja';
}

export function personStatusChipClass(person: PersonStatus): string {
  if (person.activo) return 'bg-green-50 text-green-700';
  return person.tipoInactividad === 'SUSPENSION' ? 'bg-slate-100 text-slate-600' : 'bg-red-50 text-red-500';
}

export function personStatusDotClass(person: PersonStatus): string {
  if (person.activo) return 'bg-green-500';
  return person.tipoInactividad === 'SUSPENSION' ? 'bg-slate-400' : 'bg-red-400';
}

/** Acciones de estado disponibles: una persona activa se suspende o se da de baja; una suspendida puede pasar a baja o reactivarse; una baja solo se reactiva. */
export function availableStatusActions(person: PersonStatus): PersonStatusAction[] {
  if (person.activo) return ['SUSPENSION', 'BAJA'];
  return person.tipoInactividad === 'SUSPENSION' ? ['BAJA', 'REACTIVAR'] : ['REACTIVAR'];
}

export interface StatusActionText {
  title: string;
  confirm: (nombre: string, subject: 'empleado' | 'cliente') => string;
  success: string;
  askReason: boolean;
  menuLabel: string;
  icon: string;
}

export const STATUS_ACTION_TEXT: Record<PersonStatusAction, StatusActionText> = {
  SUSPENSION: {
    title: 'Suspender',
    confirm: (nombre, subject) => `¿Suspender a ${nombre}? No podrá iniciar sesión mientras dure la suspensión${subject === 'cliente' ? ' y sus mascotas sin otra persona autorizada quedarán en pausa' : ''}. Puedes reactivarlo cuando quieras.`,
    success: 'Suspendido correctamente',
    askReason: true,
    menuLabel: 'Suspender',
    icon: 'pi pi-pause'
  },
  BAJA: {
    title: 'Dar de baja',
    confirm: (nombre, subject) => `¿Dar de baja a ${nombre}? Deja de operar en la clínica${subject === 'cliente' ? ' y sus mascotas sin otra persona autorizada quedarán en pausa' : ''}. Puedes reactivarlo si vuelve.`,
    success: 'Dado de baja correctamente',
    askReason: true,
    menuLabel: 'Dar de baja',
    icon: 'pi pi-user-minus'
  },
  REACTIVAR: {
    title: 'Reactivar',
    confirm: (nombre, subject) => `¿Reactivar a ${nombre}? Podrá volver a iniciar sesión${subject === 'cliente' ? ' y se restaurarán las mascotas que quedaron en pausa por él' : ''}.`,
    success: 'Reactivado correctamente',
    askReason: false,
    menuLabel: 'Reactivar',
    icon: 'pi pi-replay'
  }
};

function nombres(lista: string[]): string {
  return lista.join(', ');
}

/** Resumen para el administrador de lo que pasó con las mascotas del cliente; null si no hubo nada que contar. */
export function describePetOutcome(resultado: ApoderadoEstadoResponse | null | undefined):
    { severity: 'info' | 'warn'; detail: string } | null {
  if (!resultado) return null;
  const partes: string[] = [];
  let hayAdvertencia = false;
  if (resultado.mascotasRestauradas?.length) {
    partes.push(`Se reactivaron: ${nombres(resultado.mascotasRestauradas)}.`);
  }
  if (resultado.mascotasPausadas?.length) {
    partes.push(`Quedaron en pausa: ${nombres(resultado.mascotasPausadas)}.`);
  }
  if (resultado.mascotasQueSiguenInactivas?.length) {
    partes.push(`Siguen inactivas porque el personal las dio de baja por otro motivo: ${nombres(resultado.mascotasQueSiguenInactivas)}.`);
  }
  if (resultado.mascotasQueSiguenActivas?.length) {
    partes.push(`Siguen activas porque otra persona puede autorizar su atención: ${nombres(resultado.mascotasQueSiguenActivas)}. Conviene transferirles la titularidad.`);
  }
  if (resultado.mascotasConCitasVigentes?.length) {
    hayAdvertencia = true;
    partes.push(`No se pausaron por tener citas vigentes: ${nombres(resultado.mascotasConCitasVigentes)}. Resuélvelas primero.`);
  }
  if (!partes.length) return null;
  return { severity: hayAdvertencia ? 'warn' : 'info', detail: partes.join(' ') };
}

/** Si el aviso al cliente no pudo ir por correo, indica cómo avisarle; null si el correo sí pudo enviarse. */
export function describeManualNotice(cita: CitaResponse | null | undefined): string | null {
  if (!cita?.requiereAvisoManual) return null;
  const telefono = cita.telefonoAviso?.trim();
  return telefono
    ? `El cliente no tiene un correo verificado, así que no se le envió el aviso. Comunícate con él por teléfono o mensaje al ${telefono}.`
    : 'El cliente no tiene un correo verificado, así que no se le envió el aviso, y no tiene teléfono registrado. Debes contactarlo por otro medio.';
}
