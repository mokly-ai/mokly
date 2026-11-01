import { constants } from "node:os";

import { gte, valid } from "semver";

import { runCaptured } from "./process.mjs";
import { runTypecheck } from "./typecheck-runner.mjs";

const minimumVersion = "1.4.4";

/**
 * Select the optional native checker before running the shared projects.
 * Only a missing executable or an older valid version uses the standard checker.
 * @param {import("./typecheck-fast-runner.mjs").FastTypecheckOptions} options
 * @returns {Promise<number>}
 */
export async function runFastTypecheck({
  probe = runCaptured,
  writeStdout = (text) => process.stdout.write(text),
  writeStderr = (text) => process.stderr.write(text),
  ...standard
}) {
  /** @type {Awaited<ReturnType<typeof runCaptured>>} */
  let version;
  try {
    version = await probe("bun", ["--version"], { cwd: standard.root });
  } catch (error) {
    if (
      typeof error !== "object" ||
      error === null ||
      !("code" in error) ||
      error.code !== "ENOENT"
    )
      throw error;
    return standardFallback("Bun was not found.", standard, writeStderr);
  }

  if (version.stderr) writeStderr(version.stderr);
  const signal = version.interrupted ?? version.signal;
  const exitCode = signal
    ? 128 + (constants.signals[signal] ?? 1)
    : (version.exitCode ?? 1);
  if (exitCode !== 0) {
    if (version.stdout) writeStdout(version.stdout);
    return exitCode;
  }

  const number = valid(version.stdout.trim());
  if (number === null) {
    if (version.stdout) writeStdout(version.stdout);
    writeStderr("Cannot read the Bun version. Run npm run typecheck.\n");
    return 1;
  }
  if (!gte(number, minimumVersion))
    return standardFallback(
      `Bun ${number} is older than ${minimumVersion}.`,
      standard,
      writeStderr,
    );

  return runTypecheck({
    ...standard,
    program: "bun",
    args: ["check", "--no-script", "--all"],
  });
}

/**
 * @param {string} reason
 * @param {import("./typecheck-runner.mjs").TypecheckOptions} standard
 * @param {(text: string) => void} writeStderr
 * @returns {Promise<number>}
 */
function standardFallback(reason, standard, writeStderr) {
  writeStderr(
    `Warning: ${reason} Running the standard Node type check.\n` +
      `Optional installation: npm install --global bun@${minimumVersion}\n`,
  );
  return runTypecheck(standard);
}
