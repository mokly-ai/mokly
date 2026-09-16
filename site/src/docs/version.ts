/**
 * The published Mokly CLI version, read once from the workspace
 * `@mokly/mokly` package. The section tree shows it and every install snippet
 * is written against it, so the documentation can never name a version the
 * repository does not hold.
 */

import { readFileSync } from "node:fs";

import { repositoryPath } from "../workspace.js";

function read(): string {
  const manifest = JSON.parse(
    readFileSync(repositoryPath("package.json"), "utf8"),
  ) as { name?: unknown; version?: unknown };
  if (manifest.name !== "@mokly/mokly") {
    throw new Error("the site must be built beside the @mokly/mokly package");
  }
  if (typeof manifest.version !== "string" || manifest.version.length === 0) {
    throw new Error("@mokly/mokly declares no version");
  }
  return manifest.version;
}

/** The exact version of the package this site documents. */
export const PACKAGE_VERSION = read();

/** The package name every install snippet and import names. */
export const PACKAGE_NAME = "@mokly/mokly";

/** The command that installs Mokly and the React peers it renders with. */
export const INSTALL_COMMAND =
  "npm install --save-dev @mokly/mokly react react-dom";

/** The command that installs one exact published version of the package. */
export function pinnedInstallCommand(version = PACKAGE_VERSION): string {
  return `npm install --save-dev ${PACKAGE_NAME}@${version}`;
}
