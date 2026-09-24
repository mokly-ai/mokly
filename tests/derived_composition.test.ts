import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { RebuiltBaselineReader } from "../dist/baseline/reader.js";
import type { BaselineBuildRequest } from "../dist/baseline/types.js";
import { loadConfig } from "../dist/config/load.js";
import { CommittedBaselineReader } from "../dist/review/committed.js";
import { prepareReviewRepository } from "../dist/review/prepare.js";

import { MemoryBaselineFileSystem } from "./helpers/baseline_memory.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

test("composition selects committed reads without building and pins repository evidence", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const calls: string[] = [];
  const prepared = await prepareReviewRepository(config, "main", {
    runner: {
      async run(argv) {
        calls.push(argv[0]!);
        if (argv[0] === "rev-parse") return fixture.root;
        if (argv[0] === "merge-base") return "a".repeat(40);
        if (argv[0] === "ls-tree")
          return `100644 blob ${"a".repeat(40)}\tmockups/mokly-manifest.json\0`;
        if (argv[0] === "show")
          return JSON.stringify({
            entries: [],
            schemaVersion: 5,
            generatedBy: "mokly",
            sourceFiles: [],
          });
        return "notes.md\n.mokly-cache/private\n";
      },
    },
    builder: {
      async build() {
        throw new Error("committed mode must not build");
      },
    },
  });
  assert.ok(prepared.reader instanceof CommittedBaselineReader);
  assert.equal(
    await prepared.evidence.mergeBase("other", "HEAD"),
    "a".repeat(40),
  );
  assert.equal(calls.filter((name) => name === "merge-base").length, 1);
  assert.deepEqual(await prepared.evidence.changedPaths(prepared.commit), [
    "notes.md",
  ]);
  await prepared.assertUnchanged();
});

test("derived composition forwards cancellation and progress to the injected builder", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const requests: BaselineBuildRequest[] = [];
  const signal = new AbortController().signal;
  const progress: string[] = [];
  const prepared = await prepareReviewRepository(config, "main", {
    signal,
    onProgress: (event) => progress.push(event.type),
    filesystem: new MemoryBaselineFileSystem(),
    runner: {
      async run(argv) {
        return argv[0] === "rev-parse"
          ? fixture.root
          : argv[0] === "ls-tree"
            ? ""
            : "b".repeat(40);
      },
    },
    builder: {
      async build(request) {
        requests.push(request);
        request.onProgress?.({ type: "start", commit: request.commit });
        request.onProgress?.({
          type: "complete",
          commit: request.commit,
          cacheHit: false,
        });
        return {
          commit: request.commit,
          cacheHit: false,
          outputDir: path.join(
            fixture.root,
            ".mokly-cache/baselines",
            request.commit,
            "output",
          ),
          marker: {
            schemaVersion: 1,
            commit: request.commit,
            commands: request.commands,
            manifestVersion: 5,
            finishedAt: new Date(0).toISOString(),
          },
        };
      },
    },
  });
  assert.ok(prepared.reader instanceof RebuiltBaselineReader);
  assert.deepEqual(progress, ["start", "complete"]);
  assert.equal(requests.length, 1);
  assert.equal(requests[0]!.signal, signal);
  assert.equal(requests[0]!.mockupsPath, "mockups");
  assert.deepEqual(requests[0]!.commands, config.review.baselineBuild);
});

test("unavailable derived history and cancellation keep typed outcomes before building", async (t) => {
  const fixture = await createFixture(undefined, {});
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const runner = {
    async run() {
      throw new Error("missing history");
    },
  };
  await assert.rejects(
    () => prepareReviewRepository(config, "missing", { runner }),
    { code: "baseline-history-unavailable" },
  );
  await assert.rejects(
    () =>
      prepareReviewRepository(config, "main", {
        runner,
        signal: AbortSignal.abort(),
      }),
    { code: "baseline-interrupted" },
  );
});
