import { defineConfig, devices } from "@playwright/test";

import { appOrigin, appServerCommand } from "./src/_tests_/origins";

function appShard() {
  const value = process.env.MKC_APP_SHARD;
  if (!value) return undefined;
  const match = /^([0-9]+)\/([0-9]+)$/.exec(value);
  const current = Number(match?.[1]);
  const total = Number(match?.[2]);
  if (
    match?.[0] !== value ||
    !Number.isInteger(current) ||
    !Number.isInteger(total) ||
    current < 1 ||
    current > total ||
    total > 0xffff_ffff
  ) {
    throw new Error("MKC_APP_SHARD must be <n>/<total>, where 1 <= n <= total");
  }
  return { current, total };
}

/**
 * The browser suite runs the exported web build the way a deployment serves it,
 * against the real API the global setup starts: the session cookie, the CSRF
 * token and every write the reader makes are `mkc-api`'s own.
 *
 * A test routes one read or one answer where this environment cannot produce
 * it — a failure the API would only return under conditions the suite cannot
 * create, or a provider answer the recorded GitHub does not replay. Routing is how those states are reached, not a shortcut around the
 * API: what the route answers is the envelope the protocol's own table records
 * for that reason, and everything around it is still real.
 */
export default defineConfig({
  testDir: "src/_tests_",
  testMatch: "**/*.spec.ts",
  shard: appShard(),
  fullyParallel: false,
  workers: 1,
  // One retry: these tests drive a real API and a real browser, and a shared
  // machine can stall a step long enough to fail an otherwise correct run.
  retries: 1,
  timeout: 120_000,
  reporter: [["list"]],
  globalSetup: "./src/_tests_/global-setup.ts",
  globalTeardown: "./src/_tests_/global-teardown.ts",
  expect: { timeout: 15_000 },
  use: {
    baseURL: appOrigin,
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
    trace: "off",
  },
  projects: [
    {
      name: "desktop",
      testIgnore: "**/*-mobile.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "mobile",
      testMatch: "**/*-mobile.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  webServer: {
    command: appServerCommand,
    url: `${appOrigin}/dashboard`,
    // Never adopt a server this run did not start; see `api-server.ts`.
    reuseExistingServer: false,
    timeout: 60_000,
    stdout: "ignore",
  },
});
