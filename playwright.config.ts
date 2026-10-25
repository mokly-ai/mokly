import { defineConfig } from "@playwright/test";

import { browserWorkerCount } from "./scripts/verification/concurrency.mjs";
import { ownExampleServerUrl } from "./tests/browser/example_servers.js";

/** One Chromium project; complete specs remain together in every shard. */
export default defineConfig({
  forbidOnly: true,
  fullyParallel: false,
  globalSetup: "./tests/browser/setup.ts",
  projects: [{ name: "chromium" }],
  outputDir: ".context/playwright-results",
  reporter: [["list"]],
  retries: 0,
  testDir: "tests/browser",
  testMatch: "**/*.spec.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: ownExampleServerUrl(),
    channel: process.env["PLAYWRIGHT_CHANNEL"] ?? "chrome",
    trace: "retain-on-failure",
  },
  workers: browserWorkerCount(),
});
