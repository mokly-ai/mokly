import { spawn } from "node:child_process";
import path from "node:path";

import { executeNative } from "../packages/mokly/src/execution.mjs";

import { prepareDevelopment } from "./dev-preparation.mjs";
import { ExpectedFailure } from "./verification/expected-failure.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");

/** Run the npm that started this script through Node, so Windows needs no shell. */
function npm(args) {
  const cli = process.env.npm_execpath;
  if (!cli)
    throw new ExpectedFailure("Start the development server with npm run dev.");
  return executeNative(process.execPath, [cli, ...args], {
    platform: process.platform,
    spawn: (program, programArgs, options) =>
      spawn(program, programArgs, { ...options, cwd: repositoryRoot }),
    subscribe: (signal, handler) => process.on(signal, handler),
    unsubscribe: (signal, handler) => process.removeListener(signal, handler),
  });
}

try {
  await prepareDevelopment(repositoryRoot, {
    run: npm,
    report: (message) => console.error(message),
  });
  // The CLI entry reads this process's arguments, which follow the script
  // path, and owns the signals and the exit status from here.
  await import("../packages/mokly/bin/mokly.mjs");
} catch (error) {
  if (!(error instanceof ExpectedFailure)) throw error;
  console.error(error.message);
  process.exitCode = 1;
}
