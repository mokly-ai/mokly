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
        // Untagged widths exercise both layouts. Only @scheme needs dark.
        ...(colorScheme === "dark" ? { grep: /@scheme\b/ } : {}),
        grepInvert:
          width === 390 ? /@(?:desktop|narrow)\b/ : /@(?:mobile|narrow)\b/,
        use: { colorScheme, viewport: { width, height: 900 } },
      })),
    ),
    // @narrow walks every route once for horizontal overflow at 320px.
    {
      name: "320-light",
      grep: /@narrow\b/,
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
