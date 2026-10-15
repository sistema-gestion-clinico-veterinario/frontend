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
