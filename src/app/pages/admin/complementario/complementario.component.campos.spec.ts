import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ComplementarioComponent } from './complementario.component';

const campo = (validationConfig: string | null): any => ({ id: 1, validationConfig });
const version = (id: number, templateKey: string, status: string): any => ({ id, templateKey, status });

describe('ComplementarioComponent — campos de la ficha clínica', () => {
  let component: ComplementarioComponent;
  let fixture: ComponentFixture<ComplementarioComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComplementarioComponent, HttpClientTestingModule, ReactiveFormsModule],
      providers: [MessageService]
    })
      .overrideComponent(ComplementarioComponent, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(ComplementarioComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('configuración de un campo', () => {
    it('las opciones salen como texto y se conservan entre lecturas', () => {
      const f = campo('{"options":["Alto","Bajo",3]}');

      const primera = component.clinicalPreviewOptions(f);

      expect(primera).toEqual(['Alto', 'Bajo', '3']);
      expect(component.clinicalPreviewOptions(f)).toBe(primera);
    });

    it('la configuración se interpreta una sola vez por campo mientras no cambie', () => {
      const parse = spyOn(JSON, 'parse').and.callThrough();
      const texto = '{"options":["a"],"min":2,"max":7,"coreField":"peso"}';
      const f = campo(texto);

      for (let i = 0; i < 5; i++) {
        component.clinicalPreviewOptions(f);
        component.clinicalPreviewScale(f);
        component.isCoreClinicalField(f);
      }

      expect(parse.calls.allArgs().filter(args => args[0] === texto).length).toBe(1);
    });

    it('al cambiar la configuración del campo se vuelve a interpretar', () => {
      const f = campo('{"options":["a"]}');
      expect(component.clinicalPreviewOptions(f)).toEqual(['a']);

      f.validationConfig = '{"options":["a","b"]}';

      expect(component.clinicalPreviewOptions(f)).toEqual(['a', 'b']);
    });

    it('dos campos con la misma configuración no se confunden', () => {
      const uno = campo('{"options":["x"]}');
      const dos = campo('{"options":["y"]}');

      expect(component.clinicalPreviewOptions(uno)).toEqual(['x']);
      expect(component.clinicalPreviewOptions(dos)).toEqual(['y']);
    });

    it('la escala usa los límites de la configuración o 1 y 10 por defecto', () => {
      expect(component.clinicalPreviewScale(campo('{"min":0,"max":5}'))).toEqual({ min: 0, max: 5 });
      expect(component.clinicalPreviewScale(campo('{"min":"x"}'))).toEqual({ min: 1, max: 10 });
      expect(component.clinicalPreviewScale(campo(null))).toEqual({ min: 1, max: 10 });
    });

    it('un campo central es el que declara coreField', () => {
      expect(component.isCoreClinicalField(campo('{"coreField":"peso"}'))).toBeTrue();
      expect(component.isCoreClinicalField(campo('{}'))).toBeFalse();
      expect(component.isCoreClinicalField(campo(null))).toBeFalse();
    });

    it('una configuración inválida o nula no rompe nada', () => {
      for (const texto of ['no es json', 'null', '5', '[]']) {
        const f = campo(texto);
        expect(component.clinicalPreviewOptions(f)).toEqual([]);
        expect(component.clinicalPreviewScale(f)).toEqual({ min: 1, max: 10 });
        expect(component.isCoreClinicalField(f)).toBeFalse();
      }
    });
  });

  describe('versiones de la ficha seleccionada', () => {
    beforeEach(() => {
      component.clinicalVersions.set([
        version(1, 'GENERAL', 'ARCHIVED'),
        version(2, 'GENERAL', 'PUBLISHED'),
        version(3, 'GENERAL', 'DRAFT'),
        version(4, 'OTRA', 'PUBLISHED')
      ]);
      component.selectedClinicalTemplateKey.set('GENERAL');
    });

    it('solo incluye las versiones de la ficha elegida', () => {
      expect(component.selectedClinicalVersions().map(v => v.id)).toEqual([1, 2, 3]);
    });

    it('la versión vigente es la publicada de esa ficha', () => {
      expect(component.selectedClinicalPublished()?.id).toBe(2);
    });

    it('al elegir otra ficha, todo se actualiza', () => {
      component.selectedClinicalTemplateKey.set('OTRA');

      expect(component.selectedClinicalVersions().map(v => v.id)).toEqual([4]);
      expect(component.selectedClinicalPublished()?.id).toBe(4);
    });

    it('sin ficha elegida no hay versiones', () => {
      component.selectedClinicalTemplateKey.set(null);

      expect(component.selectedClinicalVersions()).toEqual([]);
      expect(component.selectedClinicalPublished()).toBeUndefined();
    });

    it('las lecturas repetidas devuelven la misma lista', () => {
      expect(component.selectedClinicalVersions()).toBe(component.selectedClinicalVersions());
    });
  });
});
