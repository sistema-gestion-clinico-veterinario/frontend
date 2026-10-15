export type EstadoConsentimientoVeterinario = 'PENDIENTE' | 'ACEPTADO' | 'RECHAZADO' | 'REVOCADO';

export interface ConsentimientoVeterinario {
  uuid: string;
  mascotaId: number;
  mascota: string;
  consultaId: number | null;
  apoderadoId: number;
  titular: string;
  procedimiento: string;
  diagnosticoIndicacion: string;
  descripcionProcedimiento: string;
  beneficiosEsperados: string;
  riesgosPrevisibles: string;
  alternativas: string;
  consecuenciasNoRealizar: string;
  autorizacionAnestesia: boolean;
  autorizacionEmergencia: boolean;
  version: number;
  contenido: string;
  contenidoHash: string;
  estado: EstadoConsentimientoVeterinario;
  creadoAt: string;
  decididoAt: string | null;
  nombreFirmante: string | null;
  documentoFirmante: string | null;
  relacionFirmante: string | null;
  preguntasAclaradas: boolean;
  motivoRechazo: string | null;
  revocadoAt: string | null;
  motivoRevocacion: string | null;
}

export interface CrearConsentimientoVeterinario {
  mascotaId: number;
  consultaId: number | null;
  apoderadoId: number;
  procedimiento: string;
  diagnosticoIndicacion: string;
  descripcionProcedimiento: string;
  beneficiosEsperados: string;
  riesgosPrevisibles: string;
  alternativas: string;
  consecuenciasNoRealizar: string;
  autorizacionAnestesia: boolean;
  autorizacionEmergencia: boolean;
}
