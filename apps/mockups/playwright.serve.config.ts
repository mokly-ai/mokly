import "./src/_tests_/clear-git-environment.mjs";

import { defineConfig } from "@playwright/test";

import disk from "./playwright.config";
import { mockupsOrigin } from "./src/_tests_/origins";

export default defineConfig({
  ...disk,
  testMatch: [
    "**/serve.spec.ts",
    "**/serve-isolation.spec.ts",
    "**/product-serve.spec.ts",
  ],
  outputDir: "../../.context/mockups-playwright-serve",
  globalTeardown: "./src/_tests_/serve-teardown.ts",
  workers: 1,
  webServer: {
    command: "npm run mockups:serve:test",
    url: mockupsOrigin,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
