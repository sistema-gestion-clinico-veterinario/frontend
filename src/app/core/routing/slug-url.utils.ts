/**
 * Primer segmento de todas las rutas reales que conoce Angular. Cualquier
 * otro primer segmento corresponde al identificador público de una empresa.
 */
const KNOWN_FIRST_SEGMENTS = new Set([
  'login', 'admin', 'forgot-password', 'reset-password', 'confirm-email-change', 'auth',
  'dashboard', 'reportes', 'company', 'auditoria', 'roles', 'ventanas', 'complementario',
  'empleados', 'clientes', 'mascotas', 'empleado', 'recetas', 'historias-clinicas', 'citas',
  'mi-horario', 'profile', 'password-change', 'legal', 'apoderado', 'mi-historial', 'pagos',
  'caja', 'laboratorio', 'tesis', 'privacidad', 'aviso-clinica', 'cuenta-cerrada'
]);
const COMPANY_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/;

export function pathnameOf(url: string): string {
  return url.split('?')[0].split('#')[0];
}

export function firstSegmentOf(pathname: string): string | null {
  return pathname.split('/').filter(Boolean)[0] ?? null;
}

export function companySlugFromUrl(url: string): string | null {
  const first = firstSegmentOf(pathnameOf(url));
  return first && COMPANY_SLUG_PATTERN.test(first) && !KNOWN_FIRST_SEGMENTS.has(first) ? first : null;
}
