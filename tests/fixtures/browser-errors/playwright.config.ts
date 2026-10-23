import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "errors.fixture.ts",
  outputDir: process.env["MOKLY_ERROR_PROBE_OUTPUT"]!,
  reporter: [["json"]],
  retries: 0,
  workers: 1,
  timeout: 20_000,
  use: { channel: process.env["PLAYWRIGHT_CHANNEL"] ?? "chrome" },
});
