import { TipoDiagnostico, EstadoDiagnostico } from '../request/diagnostico-request';

export interface DiagnosticoResponse {
  id: number;
  nombre: string;
  codigoCIE?: string;
  descripcion?: string;
  tipo: TipoDiagnostico;
  estado: EstadoDiagnostico;
  fechaProximoControl?: string;
  consultaId?: number;
  fechaConsulta?: string;
  veterinarioNombre?: string;
}
