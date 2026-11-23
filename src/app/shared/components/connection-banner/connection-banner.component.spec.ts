import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConnectionBannerComponent } from './connection-banner.component';
import { ConnectionStatusService, MENSAJE_NO_GUARDADO, MENSAJE_RECONECTANDO } from '../../../core/services/connection-status.service';

describe('ConnectionBannerComponent', () => {
  let fixture: ComponentFixture<ConnectionBannerComponent>;
  let servicio: ConnectionStatusService;

  const franja = (): HTMLElement | null => fixture.nativeElement.querySelector('[role="status"]');

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ConnectionBannerComponent] });
    fixture = TestBed.createComponent(ConnectionBannerComponent);
    servicio = TestBed.inject(ConnectionStatusService);
    fixture.detectChanges();
  });

  it('no dibuja nada mientras hay conexión', () => {
    expect(franja()).toBeNull();
  });

  it('muestra «Reconectando…» mientras hay un reintento y lo anuncia a los lectores de pantalla', () => {
    servicio.reintentoIniciado();
    fixture.detectChanges();

    expect(franja()?.textContent?.trim()).toBe(MENSAJE_RECONECTANDO);
    expect(franja()?.getAttribute('aria-live')).toBe('polite');
    servicio.reintentoTerminado(false);
  });

  it('muestra «No se guardó» cuando falla un guardado', () => {
    servicio.escrituraNoGuardada();
    fixture.detectChanges();

    expect(franja()?.textContent?.trim()).toBe(MENSAJE_NO_GUARDADO);
  });

  it('queda por encima del panel de carga a pantalla completa', () => {
    servicio.reintentoIniciado();
    fixture.detectChanges();

    expect(franja()?.className).toContain('z-[10000]');
    servicio.reintentoTerminado(false);
  });
});
