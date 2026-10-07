/** A regular file's executable mode or a symbolic link's Git mode. */
export type SourceTreeMode = "100644" | "100755" | "120000";

/** One working-tree record with raw path bytes and a lowercase content digest. */
export interface SourceTreeRecord {
  mode: SourceTreeMode;
  path: Uint8Array;
  digest: string;
}

/** Validated arguments for the fingerprint CLI. */
export interface SourceTreeArguments {
  expected?: string;
  printHead: boolean;
}

/** Decode NUL-delimited Git paths without changing their bytes. */
export function sourcePaths(listing: Uint8Array): Buffer[];

/** Hash byte-sorted mode, path and content-digest records with NUL framing. */
export function fingerprintRecords(
  records: readonly SourceTreeRecord[],
): string;

/** Read the tracked and non-ignored working tree from its repository root. */
export function readSourceTree(cwd: string): Promise<string>;

/** Require an exact fingerprint without adding a caller's usage line. */
export function validateFingerprint(value: unknown): string;

/** Validate every CLI argument before reading Git or files. */
export function parseSourceTreeArguments(
  args: readonly string[],
): SourceTreeArguments;
