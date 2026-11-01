import { constants } from "node:os";

import { valid } from "semver";

import { readBunPin } from "./bun-pin.mjs";
import { runCaptured } from "./process.mjs";
import { runTypecheck } from "./typecheck-runner.mjs";

/**
 * Require the exact pinned native checker before running the shared projects.
 * @param {import("./typecheck-ci-runner.mjs").RequiredTypecheckOptions} options
 * @returns {Promise<number>}
 */
export async function runRequiredTypecheck({
  probe = runCaptured,
  readFile,
  writeStdout = (text) => process.stdout.write(text),
  writeStderr = (text) => process.stderr.write(text),
  ...standard
}) {
  const pin = await readBunPin(standard.root, { readFile });
  if (pin.status === "invalid") {
    writeStderr(`Error: ${pin.reason}\n`);
    return 1;
  }
  /** @param {string} reason */
  const fail = (reason) =>
    writeStderr(
      `Error: ${reason}\n` +
        `Install the pinned Bun: npm install --global bun@${pin.version}\n`,
    );

  /** @type {Awaited<ReturnType<typeof runCaptured>>} */
  let version;
  try {
    version = await probe("bun", ["--version"], { cwd: standard.root });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    fail(`Cannot run Bun: ${reason}`);
    return 1;
  }

  if (version.stderr) writeStderr(version.stderr);
  const signal = version.interrupted ?? version.signal;
  const exitCode = signal
    ? 128 + (constants.signals[signal] ?? 1)
    : (version.exitCode ?? 1);
  if (exitCode !== 0) {
    if (version.stdout) writeStdout(version.stdout);
    fail(`The Bun version probe failed with exit code ${exitCode}.`);
    return exitCode;
  }

  const number = version.stdout.trim();
  if (valid(number) !== number) {
    if (version.stdout) writeStdout(version.stdout);
    fail("Cannot read the Bun version.");
    return 1;
  }
  if (number !== pin.version) {
    fail(`Bun ${number} does not match the pinned version ${pin.version}.`);
    return 1;
  }

  writeStdout(`Using Bun ${pin.version} for required native type checking.\n`);
  return runTypecheck({
    ...standard,
    program: "bun",
    args: ["check", "--no-script", "--all"],
  });
}
