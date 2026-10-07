import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { prepareFixture } from "../scripts/large/setup.mjs";

import { largeSize } from "./fixtures/large/generate.js";
import { fixtureSetupTree } from "./helpers/file_tree.js";
import { repositoryRoot } from "./helpers/fixture.js";

const execute = promisify(execFile);

test(
  "real benchmark isolates inherited details and emits a separate restored companion pass",
  { timeout: 180_000 },
  async (context) => {
    const fixture = await prepareFixture(
      repositoryRoot,
      largeSize({
        areas: 1,
        screens: 2,
        rows: 1,
        stylesheets: 1,
        stylesheetShare: 0.37,
      }),
      false,
      true,
    );
    context.after(async () => {
      await fs.rm(fixture.root, { recursive: true, force: true });
      await fs.rm(
        path.join(repositoryRoot, ".context/large-1-2-1-1-0.37-tracked.json"),
        { force: true },
      );
    });
    const setup = await fixtureSetupTree(fixture.root);
    const run = async (mode: string) =>
      execute(
        process.execPath,
        [
          "scripts/large/cli.mjs",
          mode,
          "--config",
          fixture.configPath,
          "--tracked-output",
          "--scenario",
          "linked-stylesheet",
        ],
        {
          cwd: repositoryRoot,
          env: {
            ...process.env,
            MOKLY_MATERIAL_WORK: "1",
            PLAYWRIGHT_CHANNEL: "chromium",
          },
          maxBuffer: 16 * 1024 * 1024,
        },
      ).catch((error: { stdout: string; stderr: string; code: number }) => {
        // Performance budgets do not belong in unit tests; membership/counts still must succeed.
        assert.match(error.stderr, /usable startup exceeded 5 seconds/);
        return error;
      });
    const timed = await run("benchmark");
    const samples = [...timed.stdout.matchAll(/^Benchmark sample (.*)$/gm)].map(
      (match) => JSON.parse(match[1]!),
    );
    assert.equal(samples.length, 2, timed.stderr);
    assert.ok(!timed.stderr.includes('"stage":"review.material-work"'));
    for (const sample of samples) {
      assert.equal(sample.outcome, "ok", timed.stderr);
      assert.equal(typeof sample.classificationMs, "number");
      for (const record of [sample, sample.documentWork])
        assert.ok(
          Object.keys(record).every(
            (key) =>
              !/^(companion|material|sourceNormalization|inlineFingerprint|fingerprinted|fingerprintSeam)/.test(
                key,
              ),
          ),
        );
    }
    assert.deepEqual(await fixtureSetupTree(fixture.root), setup);
    const detail = await run("details");
    const matches = [...detail.stdout.matchAll(/^Material companion (.*)$/gm)];
    assert.equal(matches.length, 1, detail.stderr);
    assert.ok(!detail.stdout.includes("Benchmark sample"));
    const companion = JSON.parse(matches[0]![1]!);
    assert.equal(companion.outcome, "ok", detail.stderr);
    assert.equal(companion.timed, false);
    assert.equal(companion.kind, "material-work-companion");
    assert.ok(companion.materialWork.materialBytes > 0);
    assert.ok(companion.materialWork.fingerprintedViews > 0);
    const counts = detail.stderr
      .split("\n")
      .filter((line) => line.startsWith("[mokly:timing] "))
      .map((line) => JSON.parse(line.slice("[mokly:timing] ".length)))
      .filter(
        (event) =>
          event.stage === "review.material-work" && event.role === "background",
      );
    assert.equal(counts.length, 1);
    assert.deepEqual(companion.materialWork, counts[0].counts);
    for (const key of [
      "templateDigest",
      "fixtureCommit",
      "scenario",
      "expectedChangedPaths",
      "expectedChangedRoutes",
      "changedPaths",
      "changedRoutes",
      "inlineStyleCounts",
      "comparisonCounts",
    ])
      if (key === "comparisonCounts") {
        const { heapPeakMiB: _sampleHeap, ...sampleCounts } = samples[0][key];
        const { heapPeakMiB: _companionHeap, ...companionCounts } =
          companion[key];
        assert.deepEqual(companionCounts, sampleCounts);
      } else assert.deepEqual(companion[key], samples[0][key], key);
    for (const key of [
      "classificationMs",
      "state",
      "usableMs",
      "changesReadyMs",
    ])
      assert.ok(!Object.hasOwn(companion, key));
    assert.deepEqual(await fixtureSetupTree(fixture.root), setup);
  },
);
