import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const backendDir = path.resolve(__dirname, '../../SystemVargasVet-Backend');

export default defineConfig({
  globalSetup: './e2e/global-setup.ts',
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  outputDir: 'test-results/e2e-artifacts',
  use: {
    baseURL: 'http://127.0.0.1:4200',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    locale: 'es-PE',
    timezoneId: 'America/Lima',
    viewport: { width: 1440, height: 1000 },
    storageState: 'e2e/.auth/admin.json',
  },
  projects: [
    {
      name: 'chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1440, height: 1000 } },
    },
  ],
  webServer: [
    {
      command: 'mvn -o -Dmaven.repo.local=C:/Users/Pcuser/.m2/repository -Dspring-boot.run.profiles=e2e -Dspring-boot.run.useTestClasspath=true -Dspring-boot.run.additional-classpath-elements=target/test-classes spring-boot:run',
      cwd: backendDir,
      url: 'http://127.0.0.1:8080/api/v1/setup/e2e/health',
      reuseExistingServer: true,
      timeout: 180_000,
    },
    {
      command: 'npm run start:e2e',
      cwd: __dirname,
      url: 'http://127.0.0.1:4200/login',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
