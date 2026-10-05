/** Metadata validation accepts parsed source or packed npm manifests. */
export function validatePackageManifest(
  metadata: unknown,
  name: string,
  cliPath?: string,
): void;

/** Validate the exact coordinated viewer dependency. */
export function validateVersionPair(cli: unknown, viewer: unknown): void;

/** Validate root or workspace CLI entries and workspace links. */
export function validateLockPair(
  lock: unknown,
  cli: unknown,
  viewer: unknown,
  cliPath?: string,
): void;

/** Require every public export target in the packed file report. */
export function validateExportFiles(metadata: unknown, report: unknown): void;

/** Read npm metadata from its owning package directory. */
export function readPackageManifest(root: string): Promise<unknown>;
