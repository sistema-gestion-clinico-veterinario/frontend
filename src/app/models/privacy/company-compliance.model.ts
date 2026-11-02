export type ControlCumplimiento = 'AVISO_PRIVACIDAD' | 'DERECHOS_DATOS' | 'USO_IA' | 'RECORDATORIOS_CORREO' | 'CONSENTIMIENTO_VETERINARIO';
export type ModoGestionCumplimiento = 'SOFTVET' | 'EXTERNO' | 'NO_APLICA';

export interface ConfiguracionCumplimiento {
  control: ControlCumplimiento;
  version: number;
  habilitado: boolean;
  modo: ModoGestionCumplimiento;
  bloqueante: boolean;
  justificacion: string;
  referenciaContractual: string | null;
  vigenteDesde: string | null;
  creadaAt: string | null;
  configuradaPor: string;
  configuracionExplicita: boolean;
  gestionadoPorSoftvet: boolean;
}

export type EstadoCumplimientoClinica = Pick<ConfiguracionCumplimiento,
  'control' | 'habilitado' | 'modo' | 'bloqueante' | 'gestionadoPorSoftvet'>;

export interface DetalleCumplimientoClinica extends EstadoCumplimientoClinica {
  version: number;
  justificacion: string;
  referenciaContractual: string | null;
  configuradaPor: string;
  configuracionExplicita: boolean;
}

export type EstadoSolicitudCambioCumplimiento = 'PENDIENTE' | 'EN_REVISION' | 'APROBADA' | 'RECHAZADA';

export interface SolicitudCambioCumplimiento {
  id: number;
  companyId: number;
  empresa: string;
  control: ControlCumplimiento;
  habilitadoSolicitado: boolean;
  modoSolicitado: ModoGestionCumplimiento;
  bloqueanteSolicitado: boolean;
  motivo: string;
  evidenciaReferencia: string | null;
  vigenteDesdeSolicitada: string | null;
  estado: EstadoSolicitudCambioCumplimiento;
  solicitadaPor: string;
  solicitadaAt: string;
  resueltaPor: string | null;
  resueltaAt: string | null;
  comentarioResolucion: string | null;
  revisionPor: string | null;
  revisionAt: string | null;
  vistaClinicaAt: string | null;
}
