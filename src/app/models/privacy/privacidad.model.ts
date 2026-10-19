import { AudienciaAvisoPrivacidad } from '../../types/privacy/audiencia-aviso-privacidad.type';
import { CanalConsentimiento } from '../../types/privacy/canal-consentimiento.type';
import { EstadoFinalidad } from '../../types/privacy/estado-finalidad.type';

export interface CamposAvisoPrivacidad {
  razonSocial: string;
  ruc: string;
  domicilio: string;
  correoDerechos: string;
  registroBancoDatos: string | null;
  encargadoTratamiento: string | null;
  finalidades: string[];
  datosObligatorios: string[];
  datosFacultativos: string[];
  destinatarios: string[];
  transferencias: string;
  plazoConservacion: string;
}

export interface AvisoPublico {
  clinica: string;
  logoUrl: string | null;
  colorPrimario: string | null;
  audiencia: AudienciaAvisoPrivacidad;
  version: number;
  vigenteDesde: string;
  contenido: string;
}

export interface DocumentoCentroLegal {
  codigo: 'AVISO_PRIVACIDAD' | 'TERMINOS_Y_CONDICIONES' | 'POLITICA_PRIVACIDAD';
  titulo: string;
  version: string;
  vigenteDesde: string;
  contenido: string;
}

export interface CentroLegalPublico {
  clinica: string;
  logoUrl: string | null;
  colorPrimario: string | null;
  documentos: DocumentoCentroLegal[];
}

export interface AvisoVersion {
  audiencia: AudienciaAvisoPrivacidad;
  version: number;
  contenido: string;
  contenidoHash: string;
  vigenteDesde: string;
  activo: boolean;
  creadoPor: string | null;
  creadoDispositivo: string | null;
  creadoIp: string | null;
  campos: CamposAvisoPrivacidad;
}

export interface VistaPreviaAviso {
  version: number;
  contenido: string;
  sinCambios: boolean;
  observaciones: string[];
}

export interface FinalidadEstado {
  codigo: string;
  descripcion: string;
  estado: EstadoFinalidad;
  fecha: string | null;
  canal: CanalConsentimiento | null;
}

export interface ConsentimientoEstado {
  avisoPublicado: boolean;
  avisoVersion: number | null;
  informada: boolean;
  informadaVersion: number | null;
  informadaFecha: string | null;
  informadaCanal: CanalConsentimiento | null;
  vistaPorLaPersona: boolean;
  finalidades: FinalidadEstado[];
}
