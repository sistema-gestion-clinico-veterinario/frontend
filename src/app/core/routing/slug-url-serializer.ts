import { Injectable, inject } from '@angular/core';
import { DefaultUrlSerializer, UrlSerializer, UrlTree } from '@angular/router';
import { CompanySlugContext } from '../services/company-slug-context.service';

/**
 * Primer segmento de TODAS las rutas reales que conoce Angular (publicas y
 * las hijas del layout autenticado) - ver app.routes.ts, mantener sincronizado
 * si se agrega una ruta nueva con un primer segmento distinto. Sirve para
 * distinguir "esto es una pagina real" de "esto es un slug de empresa": si
 * el primer segmento de la URL NO esta en este set, se asume que es un slug.
 */
const KNOWN_FIRST_SEGMENTS = new Set([
  'login', 'admin', 'forgot-password', 'reset-password', 'confirm-email-change', 'auth',
  'dashboard', 'reportes', 'company', 'auditoria', 'roles', 'ventanas', 'complementario',
  'empleados', 'clientes', 'mascotas', 'empleado', 'recetas', 'historias-clinicas', 'citas',
  'mi-horario', 'profile', 'password-change', 'legal', 'apoderado', 'mi-historial', 'pagos',
  'caja', 'laboratorio', 'tesis'
]);

function pathnameOf(url: string): string {
  return url.split('?')[0].split('#')[0];
}

function firstSegmentOf(pathname: string): string | null {
  return pathname.split('/').filter(Boolean)[0] ?? null;
}

/**
 * Traduce entre la ruta "real" que conoce Angular Router (sin slug, ej.
 * /apoderado/dashboard) y lo que se ve en la barra de direcciones (con
 * slug, ej. /clinica-vargas-vet/apoderado/dashboard) - sin que ninguna de
 * las pantallas o navegaciones existentes necesiten saber de slugs. Ver
 * CompanySlugContext para la fuente de verdad del slug actual.
 */
@Injectable()
export class SlugUrlSerializer extends UrlSerializer {
  private readonly inner = new DefaultUrlSerializer();
  private readonly slugContext = inject(CompanySlugContext);

  override parse(url: string): UrlTree {
    const pathname = pathnameOf(url);
    const first = firstSegmentOf(pathname);

    // Sin primer segmento (raiz), o el primer segmento ya es una pagina real
    // conocida (sin slug delante, ej. SuperAdmin sin empresa, o un enlace
    // viejo sin marca) - se parsea tal cual, sin tocar nada.
    if (!first || KNOWN_FIRST_SEGMENTS.has(first)) {
      return this.inner.parse(url);
    }

    // Cualquier otro primer segmento se asume que es el slug de una empresa.
    this.slugContext.setSlug(first);

    const hashIndex = url.indexOf('#');
    const hash = hashIndex >= 0 ? url.slice(hashIndex) : '';
    const withoutHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
    const queryIndex = withoutHash.indexOf('?');
    const query = queryIndex >= 0 ? withoutHash.slice(queryIndex) : '';

    const segments = pathname.split('/').filter(Boolean);
    const restPathname = '/' + segments.slice(1).join('/');
    return this.inner.parse(`${restPathname}${query}${hash}`);
  }

  override serialize(tree: UrlTree): string {
    const url = this.inner.serialize(tree);

    // Ruta reservada para SuperAdmin - nunca lleva slug, sin importar el
    // ultimo slug conocido (podria venir de una pestaña anterior).
    if (pathnameOf(url) === '/admin/login') {
      return url;
    }

    const slug = this.slugContext.slug();
    if (!slug) {
      return url;
    }

    return `/${slug}${url === '/' ? '' : url}`;
  }
}
