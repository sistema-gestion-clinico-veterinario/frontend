export interface PrescripcionResponse {
  id: number;
  medicamento: string;
  principioActivo?: string;
  dosis: string;
  frecuencia: string;
  duracionDias?: number;
  viaAdministracion: string;
  instrucciones?: string;
  fechaInicio: string;
  fechaFin?: string;
  veterinarioNombre?: string;
  fechaCreacion?: string;
}
