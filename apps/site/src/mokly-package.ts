/**
 * The installed Mokly package is the site's source of CLI-owned prose and
 * release facts. The package does not export those files, so this module
 * resolves its public entry, walks to the owning manifest, and keeps every
 * subsequent file read inside that verified package root.
 */

import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";

import { repositoryPath } from "./workspace.js";

const PACKAGE_NAME = "@mokly/mokly";

interface PackageManifest {
  readonly name?: unknown;
  readonly version?: unknown;
}

function manifest(directory: string): PackageManifest | undefined {
  const file = path.join(directory, "package.json");
  if (!existsSync(file)) return undefined;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as PackageManifest;
  } catch (error) {
    throw new Error(
      `${PACKAGE_NAME} has an unreadable package.json at ${file}`,
      { cause: error },
    );
  }
}

function packageRoot(): string {
  const hoisted = repositoryPath("ts", "node_modules", "@mokly", "mokly");
  if (!existsSync(hoisted)) {
    throw new Error(
      `${PACKAGE_NAME} is not installed for apps/site; install the workspace from package-lock.json`,
    );
  }
  const resolved = realpathSync(hoisted);
  if (manifest(resolved)?.name !== PACKAGE_NAME) {
    throw new Error(
      `The hoisted ts workspace dependency is not ${PACKAGE_NAME}`,
    );
  }
  return resolved;
}

/** The verified root of the one installed Mokly package. */
export const MOKLY_PACKAGE_ROOT = packageRoot();

const MOKLY_MANIFEST = manifest(MOKLY_PACKAGE_ROOT);
if (
  MOKLY_MANIFEST?.name !== PACKAGE_NAME ||
  typeof MOKLY_MANIFEST.version !== "string" ||
  MOKLY_MANIFEST.version.length === 0
) {
  throw new Error(`${PACKAGE_NAME} declares no valid version`);
}

/** The exact installed CLI version the site documents. */
export const MOKLY_PACKAGE_VERSION = MOKLY_MANIFEST.version;

/** Resolve a path while proving it stays inside the installed package. */
export function moklyPackagePath(...segments: readonly string[]): string {
  const target = path.resolve(MOKLY_PACKAGE_ROOT, ...segments);
  if (
    target !== MOKLY_PACKAGE_ROOT &&
    !target.startsWith(`${MOKLY_PACKAGE_ROOT}${path.sep}`)
  ) {
    throw new Error(`${PACKAGE_NAME} content escaped its package root`);
  }
  return target;
}

/** Resolve required package content with a boundary-specific build error. */
export function requiredMoklyPackagePath(
  ...segments: readonly string[]
): string {
  const target = moklyPackagePath(...segments);
  if (!existsSync(target)) {
    throw new Error(
      `${PACKAGE_NAME}@${MOKLY_PACKAGE_VERSION} does not ship ${segments.join("/")}; install the approved guide-content package`,
    );
  }
  return target;
}
