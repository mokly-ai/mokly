import { join } from "node:path";

import { defineConfig, devices } from "@playwright/test";

import {
  discoverSpecFiles,
  parseAppShard,
  readShardWeights,
  selectShardFiles,
  specDirectory,
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

/**
 * Exact patterns for the shard's files. Both projects take the same list, and
 * each project's own ignore rule then keeps its desktop or mobile specs.
 */
const shardMatch = shardFiles?.map(
  (file) =>
    new RegExp(
      `^${join(__dirname, file).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
    ),
);

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
  // The shard patterns and the discovered files share this absolute base, also
  // when the config is opened through a linked path.
  testDir: join(__dirname, specDirectory),
  // In weighted mode Playwright runs all of its single native shard, which
  // lets a valid shard without files pass with no tests, as Playwright's own
  // shards do.
  shard: shard && { current: 1, total: 1 },
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
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
      testMatch: shardMatch ?? "**/*.spec.ts",
      testIgnore: "**/*-mobile.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "mobile",
      testMatch: shardMatch ?? "**/*.spec.ts",
      testIgnore: /(?<!-mobile)\.spec\.ts$/,
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
