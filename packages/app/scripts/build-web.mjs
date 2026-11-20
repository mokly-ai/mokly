import { spawnSync } from "node:child_process";

/**
 * Export the web build with the origins it will actually be served against.
 * The ports are configurable so a second worktree, or CI running suites side
 * by side, can build and test on its own pair instead of colliding on one.
 */
const apiPort = process.env.MKC_API_PORT ?? "8080";
const appPort = process.env.MKC_APP_PORT ?? "8081";

const sync = spawnSync(process.execPath, ["scripts/sync-styles.mjs"], {
  stdio: "inherit",
});
if (sync.status !== 0) process.exit(sync.status ?? 1);

const build = spawnSync(
  "npx",
  ["expo", "export", "--platform", "web", "--output-dir", "dist", "--clear"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      EXPO_PUBLIC_MKC_API_ORIGIN:
        process.env.EXPO_PUBLIC_MKC_API_ORIGIN ?? `http://localhost:${apiPort}`,
      EXPO_PUBLIC_MKC_APP_ORIGIN:
        process.env.EXPO_PUBLIC_MKC_APP_ORIGIN ?? `http://localhost:${appPort}`,
    },
  },
);
if (build.status !== 0) process.exit(build.status ?? 1);

const verify = spawnSync(process.execPath, ["scripts/verify-web-build.mjs"], {
  stdio: "inherit",
});
process.exit(verify.status ?? 1);
