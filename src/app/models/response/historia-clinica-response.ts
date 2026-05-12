export interface DiagnosticoResumen {
  id: number;
  nombre: string;
  codigoCIE?: string;
  descripcion?: string;
  tipo: string;
  estado: string;
}

export interface TratamientoResumen {
  id: number;
  nombre: string;
  descripcion?: string;
  fechaInicio?: string;
  fechaFin?: string;
  estado: string;
}

export interface PrescripcionResumen {
  id: number;
  medicamento: string;
  principioActivo?: string;
  dosis: string;
  frecuencia: string;
  duracionDias?: number;
  viaAdministracion?: string;
  instrucciones?: string;
  fechaInicio: string;
  fechaFin?: string;
}

export interface ArchivoClinico {
  id: number;
  nombre: string;
  tipo: string;
  tipoMime?: string;
  tamanioBytes?: number;
  url: string;
  descripcion?: string;
  subidoPor?: string;
  fechaCarga: string;
}

export interface ConsultaResumen {
  id: number;
  fechaConsulta: string;
  motivoConsulta: string;
  tipoConsulta: string;
  estado?: string;
  veterinarioNombre?: string;
  pesoEnConsulta?: number;
  temperatura?: number;
  frecuenciaCardiaca?: number;
  frecuenciaRespiratoria?: number;
  mucosas?: string;
  turgenciaPiel?: string;
  vacunacionAlDia?: boolean;
  desparasitacionAlDia?: boolean;
  anamnesis?: string;
  examenFisico?: string;
  observaciones?: string;
  diagnosticos: DiagnosticoResumen[];
  tratamientos: TratamientoResumen[];
  prescripciones: PrescripcionResumen[];
  archivos: ArchivoClinico[];
}

export interface HistoriaClinicaDetalle {
  id: number;
  numeroHc: string;
  activa: boolean;
  mascotaId: number;
  mascotaNombre: string;
  especie?: string;
  raza?: string;
  sexo?: string;
  color?: string;
  senasParticulares?: string;
  edadAproximadaMeses?: number;
  esterilizado?: boolean;
  apoderadoId?: number;
  propietarioNombre?: string;
  propietarioTelefono?: string;
  propietarioDireccion?: string;
  enfermedades?: string;
  procedimientos?: string;
  antecedentesPersonales?: string;
  antecedentesFamiliares?: string;
  grupoSanguineo?: string;
  consultas: ConsultaResumen[];
}
