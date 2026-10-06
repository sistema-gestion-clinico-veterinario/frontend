import { companySlugFromUrl, firstSegmentOf, pathnameOf } from './slug-url.utils';

describe('slug-url utils', () => {
  it('detecta el slug de una empresa en la URL pública', () => {
    expect(companySlugFromUrl('/clinica-veterinaria-vargas/login')).toBe('clinica-veterinaria-vargas');
  });

  it('no interpreta una ruta real de Angular como empresa', () => {
    expect(companySlugFromUrl('/admin/productos')).toBeNull();
    expect(companySlugFromUrl('/login')).toBeNull();
  });

  it('la página pública del aviso de privacidad cuelga del slug y no se confunde con una empresa', () => {
    expect(companySlugFromUrl('/clinica-veterinaria-vargas/privacidad')).toBe('clinica-veterinaria-vargas');
    expect(companySlugFromUrl('/privacidad')).toBeNull();
  });

  it('analiza correctamente query y fragmento', () => {
    expect(pathnameOf('/vargas-vet/caja?tab=ventas#detalle')).toBe('/vargas-vet/caja');
    expect(firstSegmentOf('/vargas-vet/caja')).toBe('vargas-vet');
  });
});
