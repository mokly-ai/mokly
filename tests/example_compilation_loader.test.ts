import assert from "node:assert/strict";
import test from "node:test";

import type { ManifestV8 } from "@mokly/viewer/data";

import type { Compilation } from "../dist/build/compile.js";
import type { ExampleSnapshotRead } from "../scripts/verification/example-snapshot.mjs";

import {
  exampleCompilationLoader,
  loadExampleCompilation,
  type ExampleCompilationDependencies,
} from "./helpers/example_compilation.js";
import type { FixturePhaseTiming } from "./helpers/fixture_timing.js";

function compilation(name: string): Compilation {
  return {
    manifest: { name } as unknown as ManifestV8,
    outputs: new Map(),
    deliveredStyleSources: [],
  };
}

function harness(read: () => Promise<ExampleSnapshotRead>) {
  const timings: FixturePhaseTiming[] = [];
  const calls = { read: 0, compile: 0 };
  let now = 0;
  const compiled = compilation("compiled");
  const dependencies: ExampleCompilationDependencies = {
    read: () => {
      calls.read += 1;
      now += 5;
      return read();
    },
    compile: async () => {
      calls.compile += 1;
      now += 100;
      return compiled;
    },
    clock: () => now,
    write: (timing) => timings.push(timing),
  };
  return { calls, compiled, dependencies, timings };
}

function phases(timings: readonly FixturePhaseTiming[]) {
  return timings.map(({ fixture, phase, durationMs, status }) => ({
    fixture,
    phase,
    durationMs,
    status,
  }));
}

test("a fresh snapshot is decoded without compiling", async () => {
  const decoded = compilation("decoded");
  const { calls, dependencies, timings } = harness(async () => ({
    status: "fresh",
    compilation: decoded,
  }));
  assert.equal(await loadExampleCompilation(dependencies), decoded);
  assert.deepEqual(calls, { read: 1, compile: 0 });
  assert.deepEqual(phases(timings), [
    {
      fixture: "example-compilation",
      phase: "snapshot",
      durationMs: 5,
      status: "ok",
    },
  ]);
  assert.equal(timings[0]!.operationUnderTest, false);
});

for (const status of ["missing", "stale", "invalid"] as const)
  test(`one compile replaces the ${status} snapshot`, async () => {
    const read = async (): Promise<ExampleSnapshotRead> =>
      status === "invalid"
        ? { status, error: new Error("broken snapshot") }
        : { status };
    const { calls, compiled, dependencies, timings } = harness(read);
    assert.equal(await loadExampleCompilation(dependencies), compiled);
    assert.deepEqual(calls, { read: 1, compile: 1 });
    assert.deepEqual(phases(timings), [
      {
        fixture: "example-compilation",
        phase: "snapshot",
        durationMs: 5,
        status: "ok",
      },
      {
        fixture: "example-compilation",
        phase: `compile:${status}`,
        durationMs: 100,
        status: "ok",
      },
    ]);
  });

test("a failed fallback compile records an error phase and rejects", async () => {
  const { dependencies, timings } = harness(async () => ({ status: "stale" }));
  await assert.rejects(
    loadExampleCompilation({
      ...dependencies,
      compile: async () => {
        throw new Error("compile failed");
      },
    }),
    /compile failed/u,
  );
  assert.deepEqual(
    timings.map(({ phase, status }) => [phase, status]),
    [
      ["snapshot", "ok"],
      ["compile:stale", "error"],
    ],
  );
});

test("the loader reads the snapshot once per process", async () => {
  const decoded = compilation("decoded");
  const { calls, dependencies } = harness(async () => ({
    status: "fresh",
    compilation: decoded,
  }));
  const load = exampleCompilationLoader(dependencies);
  assert.equal(calls.read, 0);
  const [first, second] = await Promise.all([load(), load()]);
  assert.equal(first, decoded);
  assert.equal(second, decoded);
  assert.equal(await load(), decoded);
  assert.deepEqual(calls, { read: 1, compile: 0 });
});
