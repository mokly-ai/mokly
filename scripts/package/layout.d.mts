/** Repository-relative directory of the published CLI package. */
export const CLI_PACKAGE_PATH: string;

/** Resolve the CLI package directory for the configured or supplied layout. */
export function cliPackageRoot(
  repositoryRoot: string,
  packagePath?: string,
): string;

/** Map the root package's dot path to npm's empty lockfile key. */
export function cliLockKey(packagePath?: string): string;
