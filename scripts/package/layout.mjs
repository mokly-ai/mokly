import path from "node:path";

/** Repository-relative directory of the published CLI package. */
export const CLI_PACKAGE_PATH = ".";

/** Resolve the CLI package directory without changing the repository root. */
export function cliPackageRoot(repositoryRoot, packagePath = CLI_PACKAGE_PATH) {
  return path.join(repositoryRoot, packagePath);
}

/** Map the root package's dot path to npm's empty lockfile key. */
export function cliLockKey(packagePath = CLI_PACKAGE_PATH) {
  return packagePath === "." ? "" : packagePath;
}
