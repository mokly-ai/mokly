import path from "node:path";

import { CLI_PACKAGE_PATH } from "../../package/layout.mjs";

/** Source roots follow the current CLI package layout. */
export const SOURCE_ROOTS = [
  path.posix.join(CLI_PACKAGE_PATH, "src"),
  path.posix.join(CLI_PACKAGE_PATH, "scripts"),
  "packages/viewer/src",
  "packages/viewer/scripts",
  "scripts",
];
