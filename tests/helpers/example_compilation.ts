import {
  compileCatalogue,
  type Compilation,
} from "../../dist/build/compile.js";
import { loadConfig } from "../../dist/config/load.js";
import {
  readExampleSnapshot,
  type ExampleSnapshotRead,
} from "../../scripts/verification/example-snapshot.mjs";

import { repositoryRoot } from "./fixture.js";
import {
  timeFixturePhase,
  type FixtureTimingOptions,
} from "./fixture_timing.js";

const FIXTURE = "example-compilation";

/** Snapshot lookup, compile fallback, and timing output of one load. */
export interface ExampleCompilationDependencies extends FixtureTimingOptions {
  readonly read: () => Promise<ExampleSnapshotRead>;
  readonly compile: () => Promise<Compilation>;
}

/**
 * Decode a fresh snapshot, or compile when it is missing, stale, or invalid.
 * Phase `snapshot` times the lookup; a fallback adds `compile:<status>`.
 */
export async function loadExampleCompilation(
  dependencies: ExampleCompilationDependencies,
): Promise<Compilation> {
  const snapshot = await timeFixturePhase(
    FIXTURE,
    "snapshot",
    false,
    dependencies.read,
    dependencies,
  );
  if (snapshot.status === "fresh") return snapshot.compilation;
  return timeFixturePhase(
    FIXTURE,
    `compile:${snapshot.status}`,
    false,
    dependencies.compile,
    dependencies,
  );
}

/** Load at most once, so every caller in a test process shares one result. */
export function exampleCompilationLoader(
  dependencies: ExampleCompilationDependencies,
): () => Promise<Compilation> {
  let loaded: Promise<Compilation> | undefined;
  return () => (loaded ??= loadExampleCompilation(dependencies));
}

/**
 * The real example compilation for this test process. Only
 * `scripts/verification/example-snapshot.mjs` writes the snapshot; this
 * helper never does, so concurrent test files share no mutable state.
 */
export const exampleCompilation = exampleCompilationLoader({
  read: () => readExampleSnapshot(repositoryRoot),
  compile: async () =>
    compileCatalogue(
      await loadConfig(repositoryRoot, "examples/basic/mokly.config.ts"),
    ),
});
