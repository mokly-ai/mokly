import type { Compilation } from "../../dist/build/compile.js";
import type { TransferredGeneratedFile } from "../../dist/build/generated_file.js";

/** JSON-safe snapshot of one example compilation and its freshness key. */
export interface ExampleSnapshot {
  readonly schemaVersion: 1;
  readonly key: string;
  readonly diagnostics: Compilation["diagnostics"];
  readonly manifest: Compilation["manifest"];
  readonly outputs: readonly (readonly [string, TransferredGeneratedFile])[];
  readonly deliveredStyleSources: readonly string[];
  readonly documentMarkdown?: readonly (readonly [string, string])[];
}

/** Outcome of comparing a snapshot file with the current inputs. */
export type ExampleSnapshotRead =
  | { readonly status: "fresh"; readonly compilation: Compilation }
  | { readonly status: "missing" | "stale" }
  | { readonly status: "invalid"; readonly error: unknown };

/** Outcome of one producer run. */
export type ExampleSnapshotProduction =
  | { readonly status: "fresh" }
  | {
      readonly status: "written";
      readonly previous: "missing" | "stale" | "invalid";
      readonly compilation: Compilation;
    };

/** Encode a compilation and its freshness key as one JSON-safe object. */
export function encodeCompilation(
  compilation: Compilation,
  key: string,
): ExampleSnapshot;

/** Validate a parsed snapshot and rebuild the compilation it encodes. */
export function decodeCompilation(value: unknown): Compilation;

/** Classify the snapshot at `file` against the key that `currentKey` computes. */
export function readSnapshotFile(
  file: string,
  currentKey: () => Promise<string>,
): Promise<ExampleSnapshotRead>;

/** Classify the repository snapshot against the current example inputs. */
export function readExampleSnapshot(
  repositoryRoot: string,
): Promise<ExampleSnapshotRead>;

/** Write beside the snapshot, then rename, so readers never see a partial file. */
export function writeExampleSnapshot(
  file: string,
  snapshot: ExampleSnapshot,
): Promise<void>;

/** Compile and write only when the existing snapshot is not fresh. */
export function produceExampleSnapshot(options: {
  readonly file: string;
  readonly key: () => Promise<string>;
  readonly compile: () => Promise<Compilation>;
}): Promise<ExampleSnapshotProduction>;
