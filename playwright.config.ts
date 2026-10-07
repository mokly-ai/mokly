import { defineConfig } from "@playwright/test";

import {
  exampleServerPorts,
  ownExampleServerPort,
} from "./tests/browser/example_servers.js";
import { startBrowserSuiteTimer } from "./tests/helpers/browser_timing.js";

startBrowserSuiteTimer();

const ports = exampleServerPorts();

const hydrationSpecs = "**/*hydration*.spec.ts";
const projectUse = {
  channel: process.env["PLAYWRIGHT_CHANNEL"] ?? "chrome",
};

/** Browser regression configuration for the served Mokly shell. */
export default defineConfig({
  expect: { timeout: 15_000 },
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
    baseURL: `http://127.0.0.1:${ownExampleServerPort(ports)}`,
    trace: "retain-on-failure",
  },
  webServer: ports.map((port) => ({
    command: `node dist/cli/bin.js serve --config examples/basic/mokly.config.ts --base HEAD --port ${port} --no-watch`,
    reuseExistingServer: false,
    url: `http://127.0.0.1:${port}/`,
  })),
  workers: ports.length,
});
