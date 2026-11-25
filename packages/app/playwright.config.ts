import { join } from "node:path";

import { defineConfig, devices } from "@playwright/test";

import {
  discoverSpecFiles,
  parseAppShard,
  readShardWeights,
  selectShardFiles,
} from "./src/_tests_/browser-shards";
import { appOrigin, appServerCommand } from "./src/_tests_/origins";

const shard = parseAppShard(process.env.MKC_APP_SHARD);
const shardFiles =
  shard &&
  selectShardFiles(
    discoverSpecFiles(__dirname),
    readShardWeights(__dirname),
    shard,
  );

/** Exact patterns for the shard's files of one project. */
function shardMatch(mobile: boolean): RegExp[] | undefined {
  return shardFiles
    ?.filter((file) => file.endsWith("-mobile.spec.ts") === mobile)
    .map(
      (file) =>
        new RegExp(
          `^${join(__dirname, file).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        ),
    );
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
      testMatch: shardMatch(false) ?? "**/*.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "mobile",
      testMatch: shardMatch(true) ?? "**/*-mobile.spec.ts",
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
