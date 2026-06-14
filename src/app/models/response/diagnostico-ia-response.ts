export type SseEvento =
  | { type: 'meta';        escenario: string; modelo: string }
  | { type: 'chunk';       text: string }
  | { type: 'continuando'; parte: number }
  | { type: 'done' };

export const ESCENARIO_LABEL: Record<string, string> = {
  HC_solo:                  'Historia Clínica',
  HC_Hemograma:             'HC + Hemograma',
  HC_Radiografia:           'HC + Radiografía',
  HC_Hemograma_Radiografia: 'HC + Hemograma + Radiografía',
};
