export interface ParametroClinico {
  test: string;
  valor: number;
  unidad: string;
  ref_min: number | null;
  ref_max: number | null;
  flag: string | null;
  estado: 'alto' | 'bajo' | 'normal';
}

export interface SeccionParametrica {
  analizador: string;
  parametros: ParametroClinico[];
}

export interface ParametroSerologico {
  test: string;
  resultado: string;
  positivo: boolean;
}

export interface SeccionSerologia {
  analizador: string;
  parametros: ParametroSerologico[];
}

export interface LaboratorioIAResponse {
  fuente: string;
  tipo: string;
  especie: string;
  raza: string;
  edad: string;
  fecha: string;
  secciones_presentes: string[];
  comentarios_clinicos: string[];
  hematologia?: SeccionParametrica;
  quimica?: SeccionParametrica;
  serologia?: SeccionSerologia;
  alertas: string[];
}
