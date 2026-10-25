import { Component, computed, input } from '@angular/core';

export interface BloqueDocumento {
  tipo: 'texto' | 'lista';
  lineas: string[];
}

export interface SeccionDocumento {
  numero: string | null;
  titulo: string;
  bloques: BloqueDocumento[];
}

const ENCABEZADO = /^(\d{1,2})\.\s+(\S.*)$/;
const VINETA = /^[-•]\s+(.*)$/;

export function estructurarDocumento(contenido: string): SeccionDocumento[] {
  const secciones: SeccionDocumento[] = [];
  let actual: SeccionDocumento = { numero: null, titulo: '', bloques: [] };
  let bloque: BloqueDocumento | null = null;

  const cerrarSeccion = () => {
    if (actual.numero !== null || actual.bloques.length) secciones.push(actual);
  };

  for (const linea of contenido.replace(/\r\n/g, '\n').split('\n')) {
    const texto = linea.trim();
    if (!texto) {
      bloque = null;
      continue;
    }
    const encabezado = ENCABEZADO.exec(texto);
    if (encabezado && encabezado[2].length <= 90 && !encabezado[2].endsWith('.')) {
      cerrarSeccion();
      actual = { numero: encabezado[1], titulo: encabezado[2], bloques: [] };
      bloque = null;
      continue;
    }
    const vineta = VINETA.exec(texto);
    if (vineta) {
      if (bloque?.tipo !== 'lista') {
        bloque = { tipo: 'lista', lineas: [] };
        actual.bloques.push(bloque);
      }
      bloque.lineas.push(vineta[1]);
      continue;
    }
    if (bloque?.tipo !== 'texto') {
      bloque = { tipo: 'texto', lineas: [] };
      actual.bloques.push(bloque);
    }
    bloque.lineas.push(texto);
  }
  cerrarSeccion();
  return secciones;
}

let siguienteId = 0;

@Component({
  selector: 'app-documento-legal',
  standalone: true,
  templateUrl: './documento-legal.component.html'
})
export class DocumentoLegalComponent {
  readonly contenido = input.required<string>();
  readonly mostrarIndice = input(true);
  readonly compacto = input(false);

  readonly idBase = `doc-legal-${++siguienteId}`;
  readonly secciones = computed(() => estructurarDocumento(this.contenido() ?? ''));
  readonly preambulo = computed(() => this.secciones().find(seccion => seccion.numero === null) ?? null);
  readonly numeradas = computed(() => this.secciones().filter(seccion => seccion.numero !== null));
  readonly conIndice = computed(() => this.mostrarIndice() && !this.compacto());
  readonly sinEstructura = computed(() => this.numeradas().length === 0);

  irA(indice: number): void {
    document.getElementById(`${this.idBase}-${indice}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
