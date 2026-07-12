import { expect, Page, test } from '@playwright/test';

type Fixtures = {
  adminEmail: string;
  adminPassword: string;
  appointmentDate: string;
  clinicalAppointmentDate: string;
};

const RADIOGRAPHY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

async function fixtures(page: Page): Promise<Fixtures> {
  const response = await page.request.get('/api/v1/setup/e2e/fixtures');
  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function authenticatedSession(page: Page): Promise<Fixtures> {
  const data = await fixtures(page);
  await page.goto('/dashboard');
  await expect(page.getByRole('banner').getByRole('button', { name: /Empresa VargasVet E2E/ })).toBeVisible();
  return data;
}

async function openAgenda(page: Page, date: string): Promise<void> {
  await page.goto('/citas/agenda');
  const agendaResponsePromise = page.waitForResponse(response =>
    response.url().includes('/appointments?') && response.url().includes(`fecha=${date}`)
  );
  await page.locator('main input[type="date"]').fill(date);
  const agendaResponse = await agendaResponsePromise;
  expect(agendaResponse.ok(), await agendaResponse.text()).toBeTruthy();
  await expect(page.getByRole('heading', { name: 'Agenda de Citas' })).toBeVisible();
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

async function openAppointmentAction(page: Page, motive: string): Promise<void> {
  const row = page.getByRole('row').filter({ hasText: motive });
  await expect(row).toHaveCount(1);
  await row.getByRole('button').click();
}

test.describe('Flujos E2E críticos de VargasVet', () => {
  test('E2E-001 permite iniciar sesión y acceder según el rol', async ({ page }) => {
    const data = await fixtures(page);
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await page.context().clearCookies();
    await page.reload();
    await page.getByRole('textbox', { name: 'Correo electrónico' }).fill(data.adminEmail);
    await page.getByRole('textbox', { name: 'Contraseña' }).fill(data.adminPassword);
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: /Administrador E2E/ })).toBeVisible();
    await expect(page.getByText('Super Admin', { exact: true })).toBeVisible();
    await page.goto('/citas/agenda');
    await expect(page.getByRole('heading', { name: 'Agenda de Citas' })).toBeVisible();
  });

  test('E2E-002 registra propietario y mascota asociados', async ({ page }) => {
    await authenticatedSession(page);
    await page.goto('/citas/agenda');
    await page.getByRole('button', { name: /Nueva Cita/ }).click();
    const form = page.locator('#citaSidebarForm');

    await form.getByRole('button', { name: 'Nuevo cliente' }).click();
    await form.getByPlaceholder('Nombre').fill('Carlos');
    await form.getByPlaceholder('Apellido').fill('Pruebas');
    await form.getByPlaceholder('12345678').fill('70000003');
    await form.getByPlaceholder('9XX XXX XXX').fill('999000003');
    await form.getByPlaceholder('cliente@correo.com').fill('carlos.e2e@vargasvet.test');
    await form.getByPlaceholder('Av. Ejemplo 123, Distrito').fill('Av. Automatización 303');
    await form.getByRole('button', { name: 'Masculino' }).click();
    const ownerResponsePromise = page.waitForResponse(response =>
      response.url().includes('/clients/guardians') && response.request().method() === 'POST'
    );
    await form.getByRole('button', { name: 'Crear y seleccionar cliente' }).click();
    const ownerResponse = await ownerResponsePromise;
    expect(ownerResponse.ok(), await ownerResponse.text()).toBeTruthy();
    await expect(form.getByRole('button', { name: 'Carlos Pruebas' })).toBeVisible();

    await form.getByRole('button', { name: 'Nueva mascota' }).click();
    await form.getByPlaceholder('Ej: Luna').fill('Pixel Pruebas');
    const petSelects = form.locator('select:visible');
    await petSelects.nth(0).selectOption('PERRO');
    await petSelects.nth(1).selectOption('MACHO');
    await petSelects.nth(2).selectOption({ index: 1 });
    await form.locator('input[type="date"]:not([formcontrolname])').fill('2022-05-10');
    const petResponsePromise = page.waitForResponse(response =>
      response.url().endsWith('/pets') && response.request().method() === 'POST'
    );
    await form.getByRole('button', { name: 'Crear y seleccionar mascota' }).click();
    const petResponse = await petResponsePromise;
    expect(petResponse.ok(), await petResponse.text()).toBeTruthy();
    await expect(form.getByRole('button', { name: 'Pixel Pruebas' })).toBeVisible();

    await page.getByRole('button', { name: 'Descartar' }).click();
    await page.goto('/mascotas');
    await expect(page.getByText('Pixel Pruebas', { exact: true })).toBeVisible();
  });

  test('E2E-003 agenda una cita y la muestra en la agenda', async ({ page }) => {
    const data = await authenticatedSession(page);
    const targetDate = addDays(data.appointmentDate, 1);
    await page.goto('/citas/agenda');
    await page.getByRole('button', { name: /Nueva Cita/ }).click();
    const form = page.locator('#citaSidebarForm');

    await form.getByRole('button', { name: 'Seleccionar dueño...' }).click();
    await form.getByRole('button', { name: /Ana Pruebas/ }).click();
    await form.getByRole('button', { name: 'Seleccionar mascota...' }).click();
    await form.getByRole('button', { name: /Luna E2E/ }).click();
    await form.getByRole('button', { name: 'Seleccionar servicio...' }).click();
    await form.getByRole('button', { name: /Consulta general E2E/ }).click();
    await form.getByRole('button', { name: 'Seleccionar empleado...' }).click();
    await form.getByRole('button', { name: /Victor Veterinario/ }).click();
    await form.locator('[formcontrolname="fechaCita"]').fill(targetDate);
    await form.getByRole('button', { name: '13:00', exact: true }).click();
    await form.locator('[formcontrolname="motivoCita"]').fill('E2E CITA NUEVA');
    const createResponsePromise = page.waitForResponse(response =>
      response.url().endsWith('/appointments') && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Confirmar Cita' }).click();
    const createResponse = await createResponsePromise;
    expect(createResponse.ok(), await createResponse.text()).toBeTruthy();
    await expect(page.getByText('Cita programada', { exact: true })).toBeVisible();

    await openAgenda(page, targetDate);
    await expect(page.getByRole('row').filter({ hasText: 'E2E CITA NUEVA' })).toBeVisible();
  });

  test('E2E-004 reprograma una cita y conserva su información', async ({ page }) => {
    const data = await authenticatedSession(page);
    const targetDate = addDays(data.appointmentDate, 2);
    await openAgenda(page, data.appointmentDate);
    await openAppointmentAction(page, 'E2E REPROGRAMAR');
    await page.getByRole('menuitem', { name: 'Reprogramar' }).click();
    const form = page.locator('#citaSidebarForm');
    await form.locator('[formcontrolname="fechaCita"]').fill(targetDate);
    await form.getByRole('button', { name: '09:00', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmar Reprogramación' }).click();
    const rescheduleResponsePromise = page.waitForResponse(response =>
      response.url().includes('/reschedule') && response.request().method() === 'PATCH'
    );
    await page.getByRole('button', { name: 'Sí, reprogramar' }).click();
    const rescheduleResponse = await rescheduleResponsePromise;
    expect(rescheduleResponse.ok(), await rescheduleResponse.text()).toBeTruthy();

    await openAgenda(page, targetDate);
    const row = page.getByRole('row').filter({ hasText: 'E2E REPROGRAMAR' });
    await expect(row).toContainText('Reprogramada');
  });

  test('E2E-005 cancela una cita y actualiza su estado', async ({ page }) => {
    const data = await authenticatedSession(page);
    await openAgenda(page, data.appointmentDate);
    await openAppointmentAction(page, 'E2E CANCELAR');
    await page.getByRole('menuitem', { name: 'Cancelar' }).click();
    const cancelResponsePromise = page.waitForResponse(response =>
      response.url().includes('/cancel?') && response.request().method() === 'DELETE'
    );
    await page.getByRole('button', { name: 'Sí, cancelar' }).click();
    const cancelResponse = await cancelResponsePromise;
    expect(cancelResponse.ok(), await cancelResponse.text()).toBeTruthy();
    await openAgenda(page, data.appointmentDate);
    await expect(page.getByRole('row').filter({ hasText: 'E2E CANCELAR' })).toContainText('Cancelada');
  });

  test('E2E-006 registra datos clínicos, adjunta radiografía y cierra la consulta', async ({ page }) => {
    const data = await authenticatedSession(page);
    await openAgenda(page, data.clinicalAppointmentDate);
    await openAppointmentAction(page, 'E2E CONSULTA');
    const startResponsePromise = page.waitForResponse(response =>
      /\/appointments\/\d+\/start$/.test(response.url()) && response.request().method() === 'PATCH'
    );
    await page.getByRole('menuitem', { name: 'Iniciar consulta' }).click();
    const startResponse = await startResponsePromise;
    expect(startResponse.ok(), await startResponse.text()).toBeTruthy();
    await expect(page.getByRole('heading', { name: 'Atención Clínica' })).toBeVisible();

    await page.locator('[formcontrolname="pesoEnConsulta"]').fill('12.8');
    await page.locator('[formcontrolname="temperatura"]').fill('38.6');
    await page.getByRole('button', { name: 'Datos clínicos' }).click();
    const autosaveResponsePromise = page.waitForResponse(response =>
      /\/consultations\/\d+$/.test(response.url()) && response.request().method() === 'PUT'
    );
    await page.locator('[formcontrolname="anamnesis"]').fill('Paciente activo con apetito conservado');
    await page.locator('[formcontrolname="examenFisico"]').fill('Evaluación general sin alteraciones críticas');
    await page.locator('[formcontrolname="observaciones"]').fill('Control E2E completado');
    const autosaveResponse = await autosaveResponsePromise;
    expect(autosaveResponse.ok(), await autosaveResponse.text()).toBeTruthy();

    await page.getByRole('button', { name: 'Exámenes' }).click();
    await page.locator('input[type="file"]').setInputFiles({
      name: 'radiografia-e2e.jpg',
      mimeType: 'image/jpeg',
      buffer: RADIOGRAPHY_PNG,
    });
    await page.locator('select:not([formcontrolname])').selectOption('RADIOGRAFIA');
    await page.getByPlaceholder(/Hemograma completo/).fill('Radiografía de control E2E');
    const uploadResponsePromise = page.waitForResponse(response =>
      /\/consultations\/\d+\/files$/.test(response.url()) && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Subir archivo' }).click();
    const uploadResponse = await uploadResponsePromise;
    expect(uploadResponse.ok(), await uploadResponse.text()).toBeTruthy();
    await expect(page.getByText('radiografia-e2e.jpg', { exact: true })).toHaveCount(1);

    await page.getByRole('button', { name: 'Cerrar consulta' }).click();
    const closeResponsePromise = page.waitForResponse(response =>
      /\/consultations\/\d+\/close$/.test(response.url()) && response.request().method() === 'PATCH'
    );
    await page.getByRole('button', { name: 'Sí, cerrar' }).click();
    const closeResponse = await closeResponsePromise;
    expect(closeResponse.ok(), await closeResponse.text()).toBeTruthy();
    await page.goto('/historias-clinicas/mascota/HC-000001');
    await expect(page.getByText('Control E2E completado', { exact: true })).toBeVisible();
  });

  test('E2E-007 analiza un laboratorio mediante IA controlada', async ({ page }) => {
    await authenticatedSession(page);
    await page.goto('/laboratorio');
    await expect(page.getByRole('heading', { name: /Laboratorio IA/ })).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles({
      name: 'hemograma-e2e.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n%%EOF'),
    });
    await page.getByRole('button', { name: 'PERRO' }).click();
    await page.getByRole('button', { name: 'Analizar laboratorio' }).click();
    await expect(page.getByText('stub-e2e', { exact: true })).toBeVisible();
    await expect(page.getByText('Leucocitos ligeramente elevados')).toBeVisible();
  });

  test('E2E-008 obtiene asistencia IA usando la radiografía clínica', async ({ page }) => {
    await authenticatedSession(page);
    await page.goto('/historias-clinicas/mascota/HC-000001');
    await page.getByRole('button', { name: 'Asistente IA' }).click();
    await expect(page.getByText('Radiografía', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Analizar con IA' }).click();
    await expect(page.getByText('HC + Radiografía', { exact: true })).toBeVisible();
    await expect(page.getByText('Analisis E2E: sin hallazgos oseos agudos.')).toBeVisible();
  });

  test('E2E-009 registra un pago Yape aprobado en sandbox local', async ({ page }) => {
    const data = await authenticatedSession(page);
    await openAgenda(page, data.appointmentDate);
    await openAppointmentAction(page, 'E2E PAGO YAPE');
    await page.getByRole('menuitem', { name: 'Cobrar' }).click();
    await page.getByRole('button', { name: 'Yape' }).click();
    await page.getByPlaceholder('9XX XXX XXX').fill('111111111');
    await page.getByPlaceholder('000000').fill('123456');
    await page.getByPlaceholder('cliente@correo.com').fill('payer.e2e@vargasvet.test');
    const paymentResponsePromise = page.waitForResponse(response =>
      response.url().endsWith('/payments') && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Confirmar Pago' }).click();
    const paymentResponse = await paymentResponsePromise;
    expect(paymentResponse.ok(), await paymentResponse.text()).toBeTruthy();
    await expect(page.getByText('Pago con Yape registrado correctamente')).toBeVisible();
  });
});
