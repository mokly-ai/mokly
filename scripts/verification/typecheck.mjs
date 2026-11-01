import path from "node:path";
import { fileURLToPath } from "node:url";

import { runRequiredTypecheck } from "./typecheck-ci-runner.mjs";
import { runFastTypecheck } from "./typecheck-fast-runner.mjs";
import { runTypecheck } from "./typecheck-runner.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const compiler = fileURLToPath(import.meta.resolve("typescript/bin/tsc"));
const run = process.argv.includes("--ci")
  ? runRequiredTypecheck
  : process.argv.includes("--fast")
    ? runFastTypecheck
    : runTypecheck;

process.exitCode = await run({
  root,
  program: process.execPath,
  args: [compiler, "--noEmit"],
});
