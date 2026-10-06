import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PendientePrivacidad, PendientesPrivacidadService } from '../../../../core/services/pendientes-privacidad.service';
import { PendientesPrivacidadCardComponent } from './pendientes-privacidad-card.component';

describe('PendientesPrivacidadCardComponent', () => {
  let fixture: ComponentFixture<PendientesPrivacidadCardComponent>;
  let pendientes: ReturnType<typeof signal<PendientePrivacidad[]>>;
  let descartar: jasmine.Spy;

  const aviso: PendientePrivacidad = { id: 'aviso', titulo: 'Aviso de privacidad actualizado', detalle: 'La clínica actualizó su aviso de privacidad. Revísalo y confirma tu lectura.', ruta: '/profile', fragmento: 'privacidad', opcional: false };
  const ia: PendientePrivacidad = { id: 'ia', titulo: 'Uso de inteligencia artificial', detalle: 'Es opcional. Indica si autorizas su uso con los datos clínicos de tus mascotas.', ruta: '/profile', fragmento: 'privacidad', opcional: true };
  const html = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    pendientes = signal<PendientePrivacidad[]>([]);
    descartar = jasmine.createSpy('descartar');
    await TestBed.configureTestingModule({
      imports: [PendientesPrivacidadCardComponent],
      providers: [provideRouter([]), { provide: PendientesPrivacidadService, useValue: { pendientes, descartar } }],
    }).compileComponents();
    fixture = TestBed.createComponent(PendientesPrivacidadCardComponent);
    fixture.detectChanges();
  });

  it('sin pendientes no muestra nada, ni siquiera el contenedor', () => {
    expect(html().querySelector('section')).toBeNull();
    expect(html().textContent?.trim()).toBe('');
  });

  it('con pendientes muestra la tarjeta con el conteo y cada tema enlazado a su pantalla', () => {
    pendientes.set([aviso, ia]);
    fixture.detectChanges();

    expect(html().textContent).toContain('Privacidad de tus datos');
    expect(html().querySelector('[aria-label="2 pendientes"]')?.textContent?.trim()).toBe('2');
    const enlaces = [...html().querySelectorAll('a')].map(a => a.getAttribute('href'));
    expect(enlaces).toEqual(['/profile#privacidad', '/profile#privacidad']);
    expect(html().textContent).toContain('Aviso de privacidad actualizado');
    expect(html().textContent).toContain('La clínica actualizó su aviso de privacidad');
    expect(html().textContent).not.toMatch(/versi[oó]n/i);
    expect(html().textContent).toContain('Revisar');
    expect(html().textContent).toContain('Decidir');
  });

  it('con un solo pendiente habla en singular', () => {
    pendientes.set([aviso]);
    fixture.detectChanges();

    expect(html().querySelector('[aria-label="1 pendiente"]')).not.toBeNull();
  });

  it('solo lo opcional se puede dejar para más tarde', () => {
    pendientes.set([aviso, ia]);
    fixture.detectChanges();

    const botones = html().querySelectorAll('button[aria-label="Decidir más tarde"]');
    expect(botones.length).toBe(1);
    (botones[0] as HTMLButtonElement).click();
    expect(descartar).toHaveBeenCalledWith('ia');
  });

  it('al entrar a un tema avisa para que el menú móvil se cierre', () => {
    pendientes.set([aviso]);
    fixture.detectChanges();
    let avisos = 0;
    fixture.componentInstance.navigate.subscribe(() => avisos++);

    (html().querySelector('a') as HTMLAnchorElement).click();

    expect(avisos).toBe(1);
  });

  it('con el menú contraído queda un solo ícono con el conteo, que lleva al primer pendiente', () => {
    pendientes.set([aviso, ia]);
    fixture.componentRef.setInput('collapsed', true);
    fixture.detectChanges();

    expect(html().querySelectorAll('a').length).toBe(1);
    expect(html().querySelector('a')?.getAttribute('href')).toBe('/profile#privacidad');
    expect(html().querySelector('a')?.textContent?.trim()).toBe('2');
    expect(html().querySelector('a')?.getAttribute('title')).toContain('2');
    expect(html().textContent).not.toContain('Aviso de privacidad actualizado');
  });

  it('no usa el color amarillo de alerta: toma el estilo neutro de la sección de privacidad del perfil', () => {
    pendientes.set([aviso, ia]);
    fixture.detectChanges();

    expect(html().innerHTML).not.toMatch(/amber|yellow/);
    expect(html().querySelector('section > div')?.className).toContain('bg-white');
  });
});
