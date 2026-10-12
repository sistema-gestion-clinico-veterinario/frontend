type AppointmentFormMember =
  | 'displayModal' | 'isReprogramando' | 'citaForm' | 'saveCita'
  | 'showNuevoCliente' | 'showClienteSelector' | 'showNuevaMascota'
  | 'isEditing' | 'selectedClienteId' | 'selectedClienteLabel'
  | 'clienteSearch' | 'filteredClientes' | 'onClienteChange'
  | 'ncNombre' | 'onNewClientNameChange' | 'ncApellido' | 'onNewClientLastNameChange'
  | 'ncTipoDoc' | 'onNewClientDocumentTypeChange' | 'ncNumDoc' | 'onNewClientDocumentChange'
  | 'ncTelefono' | 'ncCorreo' | 'ncDireccion' | 'ncGenero' | 'avisoPrivacidad'
  | 'ncAvisoInformado' | 'ncConsentimientoRecordatorios' | 'crearNuevoCliente'
  | 'savingNuevoCliente' | 'toggleNuevaMascota' | 'showMascotaSelector'
  | 'selectedMascotaLabel' | 'filteredMascotas' | 'selectMascota'
  | 'nmNombre' | 'onNewPetNameChange' | 'nmEspecie' | 'onAgendaEspecieChange'
  | 'nmSexo' | 'nmRazaId' | 'razasAgenda' | 'loadRazasAgenda' | 'nmFechaNac'
  | 'today' | 'toDateStr' | 'crearNuevaMascota' | 'savingNuevaMascota'
  | 'showServicioSelector' | 'selectedServicioId' | 'getServicioLabel'
  | 'servicios' | 'selectServicio' | 'showVeterinarioSelector'
  | 'getVeterinarioLabel' | 'empleadosDelServicio' | 'selectVeterinario'
  | 'controlesParaServicio' | 'controlPreventivoSeleccionado'
  | 'toggleControlPreventivo' | 'onFechaCitaChange' | 'horariosResumen'
  | 'formatDiaSemana' | 'getReadOnlyFechaHora' | 'loadingSlots'
  | 'availableSlots' | 'selectTimeSlot' | 'canBookEmergency'
  | 'agendarEmergencia' | 'loadingStore';

export type AppointmentFormContext = {
  [Member in AppointmentFormMember]: any;
};
