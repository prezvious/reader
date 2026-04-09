const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  fullyParallel: false,
  use: {
    baseURL: 'http://127.0.0.1:41731',
    headless: true
  },
  webServer: {
    command: 'node scripts/static-server.js',
    url: 'http://127.0.0.1:41731/index.html',
    reuseExistingServer: false,
    timeout: 10000
  }
});
