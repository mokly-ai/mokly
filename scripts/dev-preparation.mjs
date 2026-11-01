import fs from "node:fs/promises";
import path from "node:path";

import { ExpectedFailure } from "./verification/expected-failure.mjs";
import { missingPreparedOutputs } from "./verification/prepared.mjs";

/** npm writes this record when an install completes. */
const INSTALL_RECORD = "node_modules/.package-lock.json";
/** TypeScript writes this output in the last package build of `npm run build`. */
const BUILD_RECORD = "packages/mokly/dist/sidecar.js";

/**
 * Install and build the checkout when `npm run dev` cannot serve it yet, and
 * stop at the first failed command. The dependencies install when no install
 * completed or `package-lock.json` changed after it. The build runs when an
 * output that Serve needs is missing or an install completed after the last
 * build, because the bundles carry dependency code.
 */
export async function prepareDevelopment(repositoryRoot, { run, report }) {
  const install = await installReason(repositoryRoot);
  if (install) {
    report(`Installing dependencies with npm ci, because ${install}.`);
    await runStep(run, ["ci"]);
  }
  const build = await buildReason(repositoryRoot);
  if (build) {
    report(`Building with npm run build, because ${build}.`);
    await runStep(run, ["run", "build"]);
  }
}

async function installReason(repositoryRoot) {
  const installed = await modified(repositoryRoot, INSTALL_RECORD);
  if (installed === undefined) return "they are not installed";
  const locked = await modified(repositoryRoot, "package-lock.json");
  if (locked !== undefined && locked > installed)
    return "package-lock.json changed after the last install";
  return undefined;
}

async function buildReason(repositoryRoot) {
  const [missing] = await missingPreparedOutputs(repositoryRoot, {
    browser: true,
  });
  if (missing) return `${missing} is missing`;
  const installed = await modified(repositoryRoot, INSTALL_RECORD);
  const built = await modified(repositoryRoot, BUILD_RECORD);
  if (installed !== undefined && built !== undefined && installed > built)
    return "the dependencies changed after the last build";
  return undefined;
}

/** The modification time of a repository file, or undefined when it is missing. */
async function modified(repositoryRoot, file) {
  try {
    return (await fs.stat(path.join(repositoryRoot, file))).mtimeMs;
  } catch (error) {
    if (error.code === "ENOENT") return undefined;
    throw error;
  }
}

async function runStep(run, args) {
  if ((await run(args)) !== 0)
    throw new ExpectedFailure(
      `npm run dev stopped, because npm ${args.join(" ")} failed.`,
    );
}
