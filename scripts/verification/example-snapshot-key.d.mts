/** Repository-relative snapshot file inside the Git-ignored `.context/`. */
export const EXAMPLE_SNAPSHOT_PATH: ".context/verification/example-compilation.json";

/** Snapshot format version; every key includes it. */
export const EXAMPLE_SNAPSHOT_SCHEMA_VERSION: 1;

/** Authored inputs of the example compile, listed through Git. */
export const EXAMPLE_SOURCE_PATHS: readonly [
  "examples/basic",
  "examples/imported-assets",
  "docs/protocol",
  "README.md",
];

/** List tracked and non-ignored untracked files in code-unit order. */
export function exampleSourceFiles(
  repositoryRoot: string,
  pathspecs?: readonly string[],
): Promise<string[]>;

/** Digest every input that can change the example compilation. */
export function exampleSnapshotKey(repositoryRoot: string): Promise<string>;
