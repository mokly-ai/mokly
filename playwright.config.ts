import { defineConfig } from "@playwright/test";

import { startBrowserSuiteTimer } from "./tests/helpers/browser_timing.js";

startBrowserSuiteTimer();

const configuredPort = process.env["MOKLY_PLAYWRIGHT_PORT"] ?? "4517";
const port = Number(configuredPort);
if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
  throw new Error(
    `MOKLY_PLAYWRIGHT_PORT must be an available TCP port; received ${configuredPort}`,
  );
}

const hydrationSpecs = "**/*hydration*.spec.ts";
const projectUse = {
  channel: process.env["PLAYWRIGHT_CHANNEL"] ?? "chrome",
};

/** Browser regression configuration for the served Mokly shell. */
export default defineConfig({
  forbidOnly: true,
  fullyParallel: false,
  globalSetup: "./tests/browser/setup.ts",
  projects: [
    {
      name: "chromium",
      testIgnore: hydrationSpecs,
      use: projectUse,
    },
    {
      name: "hydration",
      testMatch: hydrationSpecs,
      use: projectUse,
    },
  ],
  reporter: [["list"]],
  retries: 0,
  testDir: "tests/browser",
  testMatch: "**/*.spec.ts",
  timeout: 60_000,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `node dist/cli/bin.js serve --config examples/basic/mokly.config.ts --base HEAD --port ${port} --no-watch`,
    reuseExistingServer: false,
    url: `http://127.0.0.1:${port}/`,
  },
  workers: 1,
});
