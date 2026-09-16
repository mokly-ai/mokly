import { defineConfig } from "@playwright/test";

const configuredPort = process.env["MOKLY_SITE_PLAYWRIGHT_PORT"] ?? "4611";
const port = Number(configuredPort);
if (
  !/^[0-9]+$/.test(configuredPort) ||
  !Number.isSafeInteger(port) ||
  port < 1 ||
  port > 65_535
) {
  throw new Error(
    "MOKLY_SITE_PLAYWRIGHT_PORT must be an available TCP port (1–65535)",
  );
}

export default defineConfig({
  forbidOnly: true,
  fullyParallel: true,
  outputDir: "../test-results/site",
  projects: [
    ...[390, 1440].flatMap((width) =>
      (["light", "dark"] as const).map((colorScheme) => ({
        name: `${width}-${colorScheme}`,
        use: { colorScheme, viewport: { width, height: 900 } },
      })),
    ),
    // The narrowest width the design contract keeps usable. It walks every
    // route once for the shared accessibility checks, including horizontal
    // overflow; the scheme-dependent suites run at the two inspection widths.
    {
      name: "320-light",
      testMatch: /pages\.spec\.ts/,
      use: {
        colorScheme: "light" as const,
        viewport: { width: 320, height: 900 },
      },
    },
  ],
  reporter: [["list"]],
  retries: 0,
  testDir: "./tests/browser",
  timeout: 30_000,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    channel: process.env["PLAYWRIGHT_CHANNEL"] ?? "chrome",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `node scripts/preview.mjs ${port}`,
    cwd: import.meta.dirname,
    reuseExistingServer: false,
    url: `http://127.0.0.1:${port}/`,
  },
  workers: 2,
});
