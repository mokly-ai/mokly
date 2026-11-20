/**
 * The published Mokly CLI version, read once from the workspace
 * `@mokly/mokly` package. The section tree shows this version.
 * The shared install command adds Mokly, React and React DOM.
 * The Install component renders this command for documentation pages.
 */

import { MOKLY_PACKAGE_VERSION } from "../mokly-package.js";

/** The exact version of the package this site documents. */
export const PACKAGE_VERSION = MOKLY_PACKAGE_VERSION;

/** The package name every install snippet and import names. */
export const PACKAGE_NAME = "@mokly/mokly";

/** The command that installs Mokly and the React peers it renders with. */
export const INSTALL_COMMAND =
  "npm install --save-dev @mokly/mokly react react-dom";
