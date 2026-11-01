import { constants } from "node:os";
import path from "node:path";

import { runInherited } from "./process.mjs";

/** @type {ReadonlyArray<{ project: string; directory: string }>} */
const projects = [
  { project: "packages/mokly/tsconfig.json", directory: "." },
  { project: "tsconfig.json", directory: "." },
  { project: "packages/ui/tsconfig.json", directory: "packages/ui" },
  { project: "packages/viewer/tsconfig.json", directory: "packages/viewer" },
  { project: "tsconfig.scripts-declarations.json", directory: "." },
];

/**
 * Run the shared typecheck project inventory with an injected process boundary.
 * The process helper inherits every diagnostic and owns cancellation cleanup.
 * @param {import("./typecheck-runner.mjs").TypecheckOptions} options
 * @returns {Promise<number>}
 */
export async function runTypecheck({
  root,
  program,
  args,
  execute = runInherited,
}) {
  for (const { project, directory } of projects) {
    const cwd = path.resolve(root, directory);
    const configuration = path.relative(cwd, path.resolve(root, project));
    const outcome = await execute(
      program,
      [...args, "--project", configuration],
      { cwd },
    );
    const signal = outcome.interrupted ?? outcome.signal;
    const exitCode = signal
      ? 128 + (constants.signals[signal] ?? 1)
      : (outcome.exitCode ?? 1);
    if (exitCode !== 0) return exitCode;
  }
  return 0;
}
