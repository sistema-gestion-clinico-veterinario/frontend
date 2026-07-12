import { chromium, expect, FullConfig } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0].use.baseURL as string;
  const browser = await chromium.launch({ channel: 'chrome' });
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();

  const response = await page.request.get('/api/v1/setup/e2e/fixtures');
  expect(response.ok(), await response.text()).toBeTruthy();
  const fixture = await response.json();

  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Correo electrónico' }).fill(fixture.adminEmail);
  await page.getByRole('textbox', { name: 'Contraseña' }).fill(fixture.adminPassword);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('banner').getByRole('button', { name: /Empresa VargasVet E2E/ })).toBeVisible();

  const authDir = path.resolve(__dirname, '.auth');
  await mkdir(authDir, { recursive: true });
  await context.storageState({ path: path.join(authDir, 'admin.json') });
  await browser.close();
}
