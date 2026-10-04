import assert from "node:assert/strict";
import path from "node:path";
import { mock } from "node:test";

import { runWithTimings } from "../../dist/diagnostics/timings.js";
import { generatedViews } from "../../packages/viewer/dist/components/views.js";

import { fingerprintReplayReader } from "./fingerprint_replay_reader.mjs";

const original =
  await import("../../dist/review/component_classification_sources.js");
const fixtures = await import("./fixture.js");
const pending = new Map();
const counts = {
  catalogues: 0,
  pairs: 0,
  fingerprintHashes: 0,
  fingerprintedViews: 0,
  failures: 0,
};
const capture = async (operation) => {
  try {
    return { kind: "result", value: await operation() };
  } catch (error) {
    return {
      kind: "error",
      error,
      value: {
        name: error.name,
        message: error.message,
        ...("code" in error ? { code: error.code } : {}),
      },
    };
  }
};

mock.module("./fixture.js", {
  namedExports: {
    ...fixtures,
    async removeFixture(fixture) {
      while (pending.get(fixture.root)?.size)
        await Promise.allSettled([...pending.get(fixture.root)]);
      return fixtures.removeFixture(fixture);
    },
  },
});

mock.module("../../dist/review/component_classification_sources.js", {
  namedExports: {
    ...original,
    classifyComponentsWithSources(input) {
      const operation = compare(input);
      let tasks = pending.get(input.config.repoRoot);
      if (!tasks) pending.set(input.config.repoRoot, (tasks = new Set()));
      tasks.add(operation);
      void operation.finally(() => tasks.delete(operation)).catch(() => {});
      return operation;
    },
  },
});

async function compare(input) {
  const base = fingerprintReplayReader(input.beforeReader);
  const head = fingerprintReplayReader(input.afterReader);
  const normal = await capture(() =>
    original.classifyComponentsWithSources({
      ...input,
      beforeReader: base.observed,
      afterReader: head.observed,
    }),
  );
  counts.catalogues++;
  const beforeReader = base.replay;
  const afterReader = head.replay;
  const prefix = path.relative(input.config.repoRoot, input.config.mockupsDir);
  const generated = new Set(
    [input.before, input.after].flatMap((manifest) =>
      manifest.entries.flatMap((entry) =>
        generatedViews(entry).map(({ path: route }) => `${prefix}/${route}`),
      ),
    ),
  );
  for (const generatedOutput of ["committed", "derived"]) {
    // The corpus uses production's native parser; injected counting parsers remain confined to the original test.
    const rest = { ...input };
    delete rest.cssParser;
    delete rest.cssCacheBytes;
    const candidate = {
      ...rest,
      beforeReader,
      afterReader,
      config: { ...input.config, generatedOutput },
      changedPaths:
        generatedOutput === "derived"
          ? input.changedPaths.filter((route) => !generated.has(route))
          : input.changedPaths,
      useFastPath: false,
      useStylePath: false,
    };
    const events = [];
    const actual = await capture(() =>
      runWithTimings(
        true,
        "fingerprint-test",
        () =>
          original.classifyComponentsWithSources({
            ...candidate,
            useMaterialFingerprints: true,
          }),
        { write: (event) => events.push(event) },
      ),
    );
    const text = await capture(() =>
      runWithTimings(false, "fingerprint-test", () =>
        original.classifyComponentsWithSources({
          ...candidate,
          useMaterialFingerprints: false,
        }),
      ),
    );
    counts.pairs++;
    counts.fingerprintHashes +=
      events.find(
        ({ stage, event }) =>
          stage === "review.document-work" && event === "counts",
      )?.counts?.inlineFingerprintHashes ?? 0;
    counts.fingerprintedViews +=
      events.find(
        ({ stage, event }) =>
          stage === "review.document-work" && event === "counts",
      )?.counts?.fingerprintedViews ?? 0;
    try {
      assert.equal(actual.kind, text.kind, generatedOutput);
      assert.deepEqual(
        actual.value,
        text.value,
        `${generatedOutput}: fingerprint/text catalogue`,
      );
    } catch (error) {
      counts.failures++;
      process.stderr.write(
        `Fingerprint mismatch ${JSON.stringify({ mode: generatedOutput, actual: actual.kind === "error" ? actual.value : "result", text: text.kind === "error" ? text.value : "result" })}\n`,
      );
      throw error;
    }
  }
  if (normal.kind === "error") throw normal.error;
  return normal.value;
}

process.once("beforeExit", () => {
  process.stdout.write(
    `Fingerprint catalogue proof ${JSON.stringify({ file: process.argv[1], ...counts })}\n`,
  );
  if (counts.failures) process.exitCode = 1;
});
