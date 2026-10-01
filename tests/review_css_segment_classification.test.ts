import assert from "node:assert/strict";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import {
  runWithTimings,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";
import {
  FileSystemReviewAssetReader,
  GitReviewAssetReader,
} from "../dist/review/assets.js";
import { readBaseManifest } from "../dist/review/base_manifest.js";
import { classifyComponents } from "../dist/review/component_classification.js";
import { LightningCssRuleParser } from "../dist/review/css/rules.js";
import { CompiledReviewAssetReader } from "../dist/review/head_assets.js";
import { committedReviewRepository } from "../dist/review/repository.js";

import { inlineChangesFixture } from "./helpers/inline_changes.js";

for (const mode of ["committed", "derived"] as const)
  for (const scenario of ["owned/excluded/entry", "references", "failure"])
    test(`${mode} real ${scenario} inline and linked classification equals the whole-input oracle`, async (context) => {
      const rules = (color: string) =>
        "@layer a;@layer a{}@media screen{@supports (display:grid){@layer theme{" +
        `.actual-only{color:${color}}.entry{color:${color}}.missing{color:${color}}` +
        "}}}.pane{color:black;& .missing{color:gray}}";
      const inline = (color: string) =>
        scenario === "references"
          ? `.actual-only{background:url("../image.svg");color:${color}}`
          : rules(color) +
            (scenario === "failure" && color === "blue"
              ? ".invalid{broken}"
              : "");
      const styles = (color: string) =>
        `<link rel="stylesheet" href="../shared.css"><style>${inline(color)}</style>`;
      const fixture = await inlineChangesFixture(
        context,
        styles("red"),
        styles("blue"),
        {
          colorSchemes: false,
          files: {
            before: { "shared.css": rules("red"), "image.svg": "before-image" },
            after: { "shared.css": rules("blue"), "image.svg": "after-image" },
          },
        },
      );
      const config = { ...fixture.config, generatedOutput: mode };
      const git = committedReviewRepository(fixture.config);
      const commit = await git.evidence.mergeBase("main", "HEAD");
      const before = await readBaseManifest(git.reader, commit, config);
      const after = await compileCatalogue(config);
      const outputs = new Set(
        [...after.outputs.keys()].map((route) => `mockups/${route}`),
      );
      const changedPaths = (await git.evidence.changedPaths(commit)).filter(
        (route) => mode === "committed" || !outputs.has(route),
      );
      const classify = (
        segments: boolean,
        events: TimingEvent[],
        cssCacheBytes?: number,
      ) => {
        const native = new LightningCssRuleParser();
        return runWithTimings(
          true,
          "test",
          () =>
            classifyComponents({
              before,
              after: after.manifest,
              config,
              changedPaths,
              baseCommit: commit,
              baseRef: "main",
              useFastPath: false,
              beforeReader: new GitReviewAssetReader(
                config,
                git.reader,
                commit,
                "mockups",
              ),
              afterReader:
                mode === "derived"
                  ? new CompiledReviewAssetReader(config, after.outputs)
                  : new FileSystemReviewAssetReader(config),
              cssParser: segments
                ? native
                : { parse: (text) => native.parse(text) },
              ...(cssCacheBytes === undefined ? {} : { cssCacheBytes }),
            }),
          { write: (event) => events.push(event) },
        );
      };
      const events: TimingEvent[] = [];
      const oracle = await classify(false, []);
      assert.deepEqual(await classify(true, events), oracle);
      assert.deepEqual(await classify(true, [], 0), oracle);
      const counts = events.find(
        ({ stage, event }) =>
          stage === "review.inline-style-analysis" && event === "counts",
      )!.counts!;
      assert.ok(counts.segmentParses! > 0);
      assert.ok(counts.segmentHits! > 0);
      if (scenario === "failure") assert.ok(counts.fallbacks! > 0);
      else assert.equal(counts.fallbacks, 0);
      assert.ok(oracle.changes.length > 0);
    });
