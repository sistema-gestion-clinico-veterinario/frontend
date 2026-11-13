import { AgendaFullCalendarComponent } from '../pages/citas/agenda/agenda-full-calendar/agenda-full-calendar.component';
import { ApoderadoDashboardComponent } from '../pages/apoderado/dashboard/apoderado-dashboard.component';
import { ApoderadoPortalComponent } from '../pages/apoderado-portal/apoderado-portal.component';
import { ArchivoModalsComponent } from '../pages/historias-clinicas/form-hc/archivo-modals/archivo-modals.component';
import { AvisoClinicaComponent } from '../pages/legal/aviso-clinica/aviso-clinica.component';
import { AvisoPublicoComponent } from '../pages/legal/aviso-publico/aviso-publico.component';
import { CancelarDatosCardComponent } from '../pages/profile/cancelar-datos/cancelar-datos-card.component';
import { ChangePasswordModalComponent } from '../shared/components/admin/change-password-modal/change-password-modal.component';
import { CitaDetailPanelComponent } from '../pages/citas/agenda/cita-detail-panel/cita-detail-panel.component';
import { CloseAccountCardComponent } from '../pages/profile/close-account/close-account-card.component';
import { CodigoVerificacionComponent } from '../shared/components/codigo-verificacion/codigo-verificacion.component';
import { ConfirmEmailChangeComponent } from '../pages/auth/confirm-email-change/confirm-email-change.component';
import { ConflictingAppointmentsDialogComponent } from '../shared/components/conflicting-appointments-dialog/conflicting-appointments-dialog.component';
import { DashboardComponent } from '../pages/dashboard/dashboard.component';
import { DeleteAppointmentDialogComponent } from '../pages/citas/agenda/delete-appointment-dialog/delete-appointment-dialog.component';
import { DetalleMascotaComponent } from '../pages/mascotas/detalle-mascota/detalle-mascota.component';
import { DiagnosticoIaComponent } from '../pages/historias-clinicas/historia-clinica-mascota/diagnostico-ia/diagnostico-ia.component';
import { DocumentoLegalComponent } from '../shared/components/documento-legal/documento-legal.component';
import { EmployeeDashboardComponent } from '../pages/employee/dashboard/employee-dashboard.component';
import { ForbiddenComponent } from '../pages/errors/forbidden/forbidden.component';
import { GoogleCallbackComponent } from '../pages/auth/google-callback/google-callback.component';
import { GuidedTourOverlayComponent } from '../shared/components/guided-tour-overlay/guided-tour-overlay.component';
import { HistorialPagosComponent } from '../pages/admin/pagos/historial-pagos/historial-pagos.component';
import { LaboratorioComponent } from '../pages/laboratorio/laboratorio.component';
import { LegalAcceptComponent } from '../pages/legal/accept/legal-accept.component';
import { MiHistorialComponent } from '../pages/apoderado/mi-historial/mi-historial.component';
import { MisPagosComponent } from '../pages/apoderado/mis-pagos/mis-pagos.component';
import { MisRecetasComponent } from '../pages/apoderado/mis-recetas/mis-recetas.component';
import { NavbarComponent } from '../layouts/main-layout/navbar/navbar.component';
import { NotFoundComponent } from '../pages/errors/not-found/not-found.component';
import { PaymentDialogComponent } from '../pages/citas/agenda/payment-dialog/payment-dialog.component';
import { PendientesPrivacidadCardComponent } from '../layouts/main-layout/sidebar/pendientes-privacidad-card/pendientes-privacidad-card.component';
import { ProcessLoadingPanelComponent } from '../shared/components/process-loading-panel/process-loading-panel.component';
import { RecursoNoDisponibleComponent } from '../shared/components/recurso-no-disponible/recurso-no-disponible.component';
import { RevisionAccesosComponent } from '../pages/admin/revision-accesos/revision-accesos.component';
import { RolesComponent } from '../pages/admin/roles/roles.component';
import { RosterComponent } from '../pages/admin/employee/roster/roster.component';
import { SidebarComponent } from '../layouts/main-layout/sidebar/sidebar.component';
import { SolicitudesCancelacionComponent } from '../pages/admin/privacidad/solicitudes/solicitudes-cancelacion.component';
import { SugerenciasControlComponent } from '../pages/citas/agenda/sugerencias-control/sugerencias-control.component';
import { VentanasComponent } from '../pages/admin/ventanas/ventanas.component';
import { CategoriasProductoComponent } from '../pages/admin/categorias-producto/categorias-producto.component';
import { ClientComponent } from '../pages/admin/client/client.component';
import { ComplementarioComponent } from '../pages/admin/complementario/complementario.component';
import { EmployeeComponent } from '../pages/admin/employee/employee.component';
import { HistoriaClinicaMascotaComponent } from '../pages/historias-clinicas/historia-clinica-mascota/historia-clinica-mascota.component';
import { LotesComponent } from '../pages/admin/lotes/lotes.component';
import { ProductosComponent } from '../pages/admin/productos/productos.component';
import { AppComponent } from '../app.component';
import { MainLayoutComponent } from '../layouts/main-layout/main-layout.component';

type ComponenteConDefinicion = { ɵcmp: { onPush: boolean } };

const CONVERTIDOS: Record<string, unknown> = {
  CategoriasProductoComponent,
  ClientComponent,
  ComplementarioComponent,
  EmployeeComponent,
  HistoriaClinicaMascotaComponent,
  LotesComponent,
  ProductosComponent,
  AgendaFullCalendarComponent,
  ApoderadoDashboardComponent,
  ApoderadoPortalComponent,
  ArchivoModalsComponent,
  AvisoClinicaComponent,
  AvisoPublicoComponent,
  CancelarDatosCardComponent,
  ChangePasswordModalComponent,
  CitaDetailPanelComponent,
  CloseAccountCardComponent,
  CodigoVerificacionComponent,
  ConfirmEmailChangeComponent,
  ConflictingAppointmentsDialogComponent,
  DashboardComponent,
  DeleteAppointmentDialogComponent,
  DetalleMascotaComponent,
  DiagnosticoIaComponent,
  DocumentoLegalComponent,
  EmployeeDashboardComponent,
  ForbiddenComponent,
  GoogleCallbackComponent,
  GuidedTourOverlayComponent,
  HistorialPagosComponent,
  LaboratorioComponent,
  LegalAcceptComponent,
  MiHistorialComponent,
  MisPagosComponent,
  MisRecetasComponent,
  NavbarComponent,
  NotFoundComponent,
  PaymentDialogComponent,
  PendientesPrivacidadCardComponent,
  ProcessLoadingPanelComponent,
  RecursoNoDisponibleComponent,
  RevisionAccesosComponent,
  RolesComponent,
  RosterComponent,
  SidebarComponent,
  SolicitudesCancelacionComponent,
  SugerenciasControlComponent,
  VentanasComponent
};

const ANFITRIONES_DEL_ENRUTADOR: Record<string, unknown> = {
  AppComponent,
  MainLayoutComponent
};

const usaOnPush = (clase: unknown) => (clase as ComponenteConDefinicion).ɵcmp.onPush;

describe('Detección de cambios OnPush', () => {
  for (const [nombre, clase] of Object.entries(CONVERTIDOS)) {
    it(`${nombre} usa OnPush`, () => {
      expect(usaOnPush(clase)).toBeTrue();
    });
  }

  for (const [nombre, clase] of Object.entries(ANFITRIONES_DEL_ENRUTADOR)) {
    it(`${nombre} contiene el router-outlet y no usa OnPush mientras existan páginas con estado en campos normales`, () => {
      expect(usaOnPush(clase)).toBeFalse();
    });
  }
});
