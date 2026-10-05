import {
  availableStatusActions,
  cuerpoDeEstado,
  describeManualNotice,
  describePetOutcome,
  personStatusChipClass,
  personStatusLabel
} from './person-status';

const vacio = { mascotasPausadas: [], mascotasRestauradas: [], mascotasQueSiguenActivas: [], mascotasConCitasVigentes: [] };

describe('person-status', () => {
  describe('estado de una persona', () => {
    it('distingue activo, suspendido y de baja', () => {
      expect(personStatusLabel({ activo: true })).toBe('Activo');
      expect(personStatusLabel({ activo: false, tipoInactividad: 'SUSPENSION' })).toBe('Suspendido');
      expect(personStatusLabel({ activo: false, tipoInactividad: 'BAJA' })).toBe('De baja');
    });

    it('una persona inactiva sin tipo (datos antiguos) se muestra como dada de baja', () => {
      expect(personStatusLabel({ activo: false })).toBe('De baja');
      expect(personStatusChipClass({ activo: false })).toContain('red');
    });

    it('las acciones disponibles dependen del estado', () => {
      expect(availableStatusActions({ activo: true })).toEqual(['SUSPENSION', 'BAJA']);
      expect(availableStatusActions({ activo: false, tipoInactividad: 'SUSPENSION' })).toEqual(['BAJA', 'REACTIVAR']);
      expect(availableStatusActions({ activo: false, tipoInactividad: 'BAJA' })).toEqual(['REACTIVAR']);
      expect(availableStatusActions({ activo: false })).toEqual(['REACTIVAR']);
    });
  });

  describe('cuerpoDeEstado', () => {
    it('solo envía lo que se indicó', () => {
      expect(cuerpoDeEstado({})).toEqual({});
      expect(cuerpoDeEstado({ tipo: 'BAJA', reason: '' })).toEqual({ tipo: 'BAJA' });
      expect(cuerpoDeEstado({ tipo: 'SUSPENSION', reason: 'Licencia' })).toEqual({ tipo: 'SUSPENSION', reason: 'Licencia' });
    });
  });

  describe('describePetOutcome', () => {
    it('sin nada que contar no hay aviso', () => {
      expect(describePetOutcome(null)).toBeNull();
      expect(describePetOutcome(vacio)).toBeNull();
    });

    it('cuenta las restauradas y las pausadas', () => {
      const aviso = describePetOutcome({ ...vacio, mascotasRestauradas: ['Luna'], mascotasPausadas: ['Rex'] });

      expect(aviso?.severity).toBe('info');
      expect(aviso?.detail).toContain('Se reactivaron: Luna.');
      expect(aviso?.detail).toContain('Quedaron en pausa: Rex.');
    });

    it('al reactivar explica por qué una mascota no volvió, con su motivo', () => {
      const aviso = describePetOutcome({
        ...vacio, mascotasRestauradas: ['Luna'], mascotasQueSiguenInactivas: ['Rex (fallecimiento)', 'Toby (dejó de asistir)']
      });

      expect(aviso?.severity).toBe('info');
      expect(aviso?.detail).toContain('Se reactivaron: Luna.');
      expect(aviso?.detail).toContain('Siguen inactivas porque el personal las dio de baja por otro motivo: Rex (fallecimiento), Toby (dejó de asistir).');
    });

    it('si solo hay mascotas que siguen inactivas también lo cuenta', () => {
      const aviso = describePetOutcome({ ...vacio, mascotasQueSiguenInactivas: ['Rex (fallecimiento)'] });

      expect(aviso?.detail).toBe('Siguen inactivas porque el personal las dio de baja por otro motivo: Rex (fallecimiento).');
    });

    it('las citas vigentes son una advertencia', () => {
      const aviso = describePetOutcome({ ...vacio, mascotasConCitasVigentes: ['Max'] });

      expect(aviso?.severity).toBe('warn');
      expect(aviso?.detail).toContain('Max');
    });
  });

  describe('describeManualNotice', () => {
    it('sin aviso pendiente no dice nada', () => {
      expect(describeManualNotice(null)).toBeNull();
      expect(describeManualNotice({ requiereAvisoManual: false } as any)).toBeNull();
    });

    it('indica el teléfono al que hay que llamar o escribir', () => {
      const texto = describeManualNotice({ requiereAvisoManual: true, telefonoAviso: ' 987654321 ' } as any);

      expect(texto).toContain('987654321');
      expect(texto).toContain('teléfono o mensaje');
    });

    it('si no hay teléfono lo dice', () => {
      const texto = describeManualNotice({ requiereAvisoManual: true, telefonoAviso: null } as any);

      expect(texto).toContain('no tiene teléfono registrado');
    });
  });
});
