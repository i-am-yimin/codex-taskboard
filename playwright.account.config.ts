import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// These suites own their isolated PostgreSQL schema and ephemeral HTTP server,
// and serve the production build. They do not need a Vite or preview service.
export default defineConfig({
  ...base,
  testMatch: ['account-center.spec.ts', 'account-privacy.spec.ts', 'server-setup.spec.ts'],
  webServer: [],
});
