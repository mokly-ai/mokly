import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "src/_tests_",
  testMatch: "**/*.spec.ts",
  workers: 1,
  timeout: 900_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  webServer: {
    command: `node ../app/scripts/serve-dist.mjs ../app/dist ${process.env.MKC_APP_PORT ?? "8081"}`,
    url: `http://localhost:${process.env.MKC_APP_PORT ?? "8081"}/dashboard`,
    reuseExistingServer: false,
  },
  globalSetup: "./src/_tests_/global-setup.ts",
  globalTeardown: "../app/src/_tests_/global-teardown.ts",
  use: { actionTimeout: 20_000, navigationTimeout: 30_000, trace: "off" },
});
