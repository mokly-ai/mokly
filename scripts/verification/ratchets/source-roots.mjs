import path from "node:path";

import { CLI_PACKAGE_PATH } from "../../package/layout.mjs";

/** Source roots follow the current CLI package layout. */
export const SOURCE_ROOTS = sourceRoots();

/** Keep root and workspace layouts free of repeated source directories. */
export function sourceRoots(packagePath = CLI_PACKAGE_PATH) {
  return [
    ...new Set([
      path.posix.join(packagePath, "src"),
      path.posix.join(packagePath, "scripts"),
      "packages/viewer/src",
      "packages/viewer/scripts",
      "scripts",
    ]),
  ];
}
