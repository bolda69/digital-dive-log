const { defineConfig } = require('@playwright/test');

// Programmatically kill any existing process on port 3000 to avoid EADDRINUSE
if (process.env.TEST_WORKER_INDEX === undefined) {
  try {
    const { execSync } = require('child_process');
    const stdout = execSync('lsof -t -i:3000');
    const pid = parseInt(stdout.toString().trim(), 10);
    if (pid && pid !== process.pid) {
      console.log(`Killing existing process ${pid} on port 3000...`);
      process.kill(pid, 'SIGKILL');
      // Wait for the port to be released
      execSync('sleep 1');
    }
  } catch (e) {
    // Port is already free or lsof/kill failed
  }
}

module.exports = defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:3000',
  },
  webServer: {
    command: 'node e2e/mock-server.js',
    port: 3000,
    reuseExistingServer: false,
  },
});
