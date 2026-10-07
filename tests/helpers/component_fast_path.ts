import assert from "node:assert/strict";

import type { Compilation } from "../../dist/build/compile.js";
import type { ResolvedConfig } from "../../dist/config/types.js";
import {
  runWithTimings,
  type TimingEvent,
} from "../../dist/diagnostics/timings.js";
import { classifyComponents } from "../../dist/review/component_classification.js";
import type { ComponentClassificationInput } from "../../dist/review/component_classification_input.js";
import { classifyComponentsWithSources } from "../../dist/review/component_classification_sources.js";
import type { Manifest } from "../../packages/viewer/dist/registry/types.js";
import type { ReviewResultV6 } from "../../packages/viewer/dist/review/component_types.js";

type FixtureFile = string | Uint8Array;

export interface FastPathFixture {
  before: Manifest;
  after: Manifest;
  beforeFiles: ReadonlyMap<string, FixtureFile>;
  afterFiles: ReadonlyMap<string, FixtureFile>;
  changedPaths: readonly string[];
  config: ResolvedConfig;
}

export function compilationFiles(
  compilation: Compilation,
  resources: Readonly<Record<string, FixtureFile>> = {},
): ReadonlyMap<string, FixtureFile> {
  return new Map<string, FixtureFile>([
    ...[...compilation.outputs].map(
      ([route, bytes]) => [`mokly-generated/${route}`, bytes] as const,
    ),
    ...Object.entries(resources),
  ]);
}

/** Inspect the exact sources recorded by one real classifier run. */
export function classifyFixtureWithSources(fixture: FastPathFixture) {
  return classifyComponentsWithSources({
    before: fixture.before,
    after: fixture.after,
    beforeReader: memoryReader(fixture.beforeFiles),
    afterReader: memoryReader(fixture.afterFiles),
    config: fixture.config,
    changedPaths: fixture.changedPaths,
    baseCommit: "a".repeat(40),
    baseRef: "main",
  });
}

export async function assertFastPathEquivalent(
  fixture: FastPathFixture,
): Promise<ReviewResultV6> {
  return comparisonModes(fixture, true);
}

/** Compare enabled and forced-complete modes without claiming a view settled early. */
export async function assertComparisonModesEquivalent(
  fixture: FastPathFixture,
): Promise<ReviewResultV6> {
  return comparisonModes(fixture, false);
}

async function comparisonModes(
  fixture: FastPathFixture,
  requireFastPath: boolean,
): Promise<ReviewResultV6> {
  const input = {
    before: fixture.before,
    after: fixture.after,
    config: fixture.config,
    changedPaths: fixture.changedPaths,
    baseCommit: "a".repeat(40),
    baseRef: "main",
  } satisfies Omit<
    ComponentClassificationInput,
    "beforeReader" | "afterReader"
  >;
  const classify = (useFastPath: boolean) =>
    classifyComponents({
      ...input,
      beforeReader: memoryReader(fixture.beforeFiles),
      afterReader: memoryReader(fixture.afterFiles),
      useFastPath,
      useStylePath: false,
    });
  const events: TimingEvent[] = [];
  const fast = await runWithTimings(true, "test", () => classify(true), {
    write: (event) => events.push(event),
  });
  const complete = await classify(false);
  const counts = events.find(
    (event) =>
      event.stage === "review.compare-screens" && event.event === "counts",
  )?.counts;
  if (requireFastPath)
    assert.ok(Number(counts?.fastPath) > 0, "fast path settled no views");
  assert.deepEqual(fast, complete);
  return fast;
}

export function memoryReader(files: ReadonlyMap<string, FixtureFile>) {
  const find = (route: string): Uint8Array | undefined => {
    const value = files.get(route);
    return typeof value === "string" ? Buffer.from(value) : value;
  };
  return {
    read: async (route: string) => {
      const value = find(route);
      assert.ok(value, `Missing fixture resource: ${route}`);
      return value;
    },
    readIfExists: async (route: string) => find(route),
  };
}
