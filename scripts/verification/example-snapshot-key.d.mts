/** Repository-relative snapshot file inside the Git-ignored `.context/`. */
export const EXAMPLE_SNAPSHOT_PATH: ".context/verification/example-compilation.json";

/** Snapshot format version; every key includes it. */
export const EXAMPLE_SNAPSHOT_SCHEMA_VERSION: 2;

/** Authored inputs of the example compile, listed through Git and copied by tests. */
export const EXAMPLE_SOURCE_PATHS: readonly [
  "examples/basic",
  "examples/imported-assets",
  "docs/protocol",
  "README.md",
  "plans",
];

/** List tracked and non-ignored untracked authored inputs in code-unit order. */
export function exampleSourceFiles(repositoryRoot: string): Promise<string[]>;

/** Digest every input that can change the example compilation. */
export function exampleSnapshotKey(repositoryRoot: string): Promise<string>;
