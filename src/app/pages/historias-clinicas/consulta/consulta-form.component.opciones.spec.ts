import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { ConsultaFormComponent } from './consulta-form.component';

const campo = (validationConfig: string | null): any => ({ id: 1, validationConfig });

describe('ConsultaFormComponent — opciones de los campos de la ficha', () => {
  let component: ConsultaFormComponent;
  let fixture: ComponentFixture<ConsultaFormComponent>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ConsultaFormComponent, HttpClientTestingModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: () => '1' } },
            params: of({ id: '1' }),
            queryParams: of({}),
            queryParamMap: of(convertToParamMap({}))
          }
        },
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate', 'navigateByUrl']) },
        { provide: MessageService, useValue: { add: jasmine.createSpy('add') } },
        { provide: ConfirmationService, useValue: { confirm: jasmine.createSpy('confirm') } }
      ]
    })
      .overrideComponent(ConsultaFormComponent, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(ConsultaFormComponent);
    component = fixture.componentInstance;
  });

  it('las opciones salen como texto y se conservan entre lecturas', () => {
    const f = campo('{"options":["Leve","Grave",2]}');

    const primera = component.customFieldOptions(f);

    expect(primera).toEqual(['Leve', 'Grave', '2']);
    expect(component.customFieldOptions(f)).toBe(primera);
  });

  it('la configuración se interpreta una sola vez por campo mientras no cambie', () => {
    const parse = spyOn(JSON, 'parse').and.callThrough();
    const texto = '{"options":["a","b"]}';
    const f = campo(texto);

    for (let i = 0; i < 6; i++) component.customFieldOptions(f);

    expect(parse.calls.allArgs().filter(args => args[0] === texto).length).toBe(1);
  });

  it('al cambiar la configuración del campo se vuelve a interpretar', () => {
    const f = campo('{"options":["a"]}');
    expect(component.customFieldOptions(f)).toEqual(['a']);

    f.validationConfig = '{"options":["a","b"]}';

    expect(component.customFieldOptions(f)).toEqual(['a', 'b']);
  });

  it('un campo sin configuración o con una configuración inválida no tiene opciones', () => {
    expect(component.customFieldOptions(campo(null))).toEqual([]);
    expect(component.customFieldOptions(campo(''))).toEqual([]);
    expect(component.customFieldOptions(campo('no es json'))).toEqual([]);
    expect(component.customFieldOptions(campo('{"otra":1}'))).toEqual([]);
  });
});
