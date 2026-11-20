/**
 * Starts the served test server: Serve with the canonical configuration and a
 * base ref that does not exist, so Changes stay unavailable and no base is
 * extracted or installed. Before Serve starts, it records the build output and
 * the checkout, which the suite and `serve-teardown.ts` compare, and it
 * records the Serve process and its exit for the teardown.
 */

import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { mockupsPort } from "./origins";
import {
  missingBase,
  recordedStateFile,
  repositoryRoot,
  serveExitFile,
  serveProcessFile,
  servedRecords,
  servedState,
} from "./served-files";

const base = spawnSync(
  "git",
  ["rev-parse", "--verify", "--quiet", "--end-of-options", missingBase],
  { cwd: repositoryRoot },
);
if (base.status !== 1)
  throw new Error(
    "The served tests need a base ref that does not exist: " + missingBase,
  );

mkdirSync(servedRecords, { recursive: true });
rmSync(serveExitFile, { force: true });
writeFileSync(recordedStateFile, JSON.stringify(servedState()));

const child = spawn(
  "mokly",
  [
    "serve",
    "--config",
    "../../mokly.config.json",
    "--base",
    missingBase,
    "--no-watch",
    "--port",
    String(mockupsPort),
  ],
  {
    cwd: resolve(repositoryRoot, "apps/mockups"),
    stdio: "inherit",
  },
);
writeFileSync(serveProcessFile, JSON.stringify({ pid: child.pid }));
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => child.kill(signal));
child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  writeFileSync(serveExitFile, JSON.stringify({ code, signal }));
  process.exitCode = code ?? 1;
});
