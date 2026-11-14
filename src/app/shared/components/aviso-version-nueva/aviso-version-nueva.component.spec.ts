import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VersionNuevaService } from '../../../core/services/version-nueva.service';
import { AvisoVersionNuevaComponent } from './aviso-version-nueva.component';

describe('AvisoVersionNuevaComponent', () => {
  let fixture: ComponentFixture<AvisoVersionNuevaComponent>;
  let version: VersionNuevaService;

  const aviso = () => fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement | null;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AvisoVersionNuevaComponent] }).compileComponents();
    fixture = TestBed.createComponent(AvisoVersionNuevaComponent);
    version = TestBed.inject(VersionNuevaService);
    fixture.detectChanges();
  });

  it('no muestra nada mientras no haya versión nueva', () => {
    expect(aviso()).toBeNull();
  });

  it('muestra el aviso cuando falla la carga de un fragmento', async () => {
    version.registrarError(new TypeError('Failed to fetch dynamically imported module: x'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(aviso()?.textContent).toContain('Hay una versión nueva');
  });

  it('el botón recarga la página', async () => {
    const recargar = spyOn(version, 'recargar');
    version.registrarError(new TypeError('Importing a module script failed.'));
    fixture.detectChanges();

    (aviso()?.querySelector('button') as HTMLButtonElement).click();

    expect(recargar).toHaveBeenCalledTimes(1);
  });
});
