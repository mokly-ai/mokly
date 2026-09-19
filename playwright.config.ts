import { defineConfig } from "@playwright/test";

const configuredPort = process.env["MOKLY_PLAYWRIGHT_PORT"] ?? "4517";
const port = Number(configuredPort);
if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
  throw new Error(
    `MOKLY_PLAYWRIGHT_PORT must be an available TCP port; received ${configuredPort}`,
  );
}

/** Browser regression configuration for the served Mokly shell. */
export default defineConfig({
  forbidOnly: true,
  fullyParallel: false,
  globalSetup: "./tests/browser/setup.ts",
  projects: [
    {
      name: "chromium",
      use: {
        channel: process.env["PLAYWRIGHT_CHANNEL"] ?? "chrome",
      },
    },
  ],
  reporter: [["list"]],
  retries: 0,
  testDir: "tests/browser",
  timeout: 60_000,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `node dist/cli/bin.js serve --config examples/basic/mokly.config.ts --port ${port} --no-watch`,
    reuseExistingServer: false,
    url: `http://127.0.0.1:${port}/`,
  },
  workers: 1,
});
