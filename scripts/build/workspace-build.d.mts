/** The directory of the records of the last successful package builds. */
export const BUILD_RECORDS: string;

/** The process and output boundary of the workspace build. */
export interface WorkspaceBuild {
  /** Run one command, its program first, at the repository root; resolve its exit status. */
  run(command: readonly string[]): Promise<number>;
  /** Print one progress line. */
  report(message: string): void;
}

/**
 * Build the native binary and every package step whose inputs or outputs
 * changed since its last successful build. Resolve the names of the failed
 * steps, `native` for the native build.
 */
export function runWorkspaceBuild(
  repositoryRoot: string,
  build: WorkspaceBuild,
): Promise<string[]>;
