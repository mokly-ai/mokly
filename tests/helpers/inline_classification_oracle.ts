import assert from "node:assert/strict";

import { compileCatalogue } from "../../dist/build/compile.js";
import { GitReviewAssetReader } from "../../dist/review/assets.js";
import { readBaseManifest } from "../../dist/review/base_manifest.js";
import { classifyComponents } from "../../dist/review/component_classification.js";
import { LightningCssRuleParser } from "../../dist/review/css/rules.js";
import { CompiledReviewAssetReader } from "../../dist/review/head_assets.js";

import { committedReviewRepository } from "./committed_repository.js";
import type { inlineChangesFixture } from "./inline_changes.js";

export async function compareInlineClassification(
  fixture: Awaited<ReturnType<typeof inlineChangesFixture>>,
  mode: "committed" | "derived",
) {
  const config = fixture.config;
  const git = committedReviewRepository(fixture.config);
  const commit = await git.evidence.mergeBase("main", "HEAD");
  const before = await readBaseManifest(git.reader, commit, config);
  const after = await compileCatalogue(config);
  const outputs = new Set(
    [...after.outputs.keys()].map(
      (route) => `mockups/mokly-generated/${route}`,
    ),
  );
  const changedPaths = (await git.evidence.changedPaths(commit)).filter(
    (route) => mode === "committed" || !outputs.has(route),
  );
  const classify = (segments: boolean) => {
    const native = new LightningCssRuleParser();
    return classifyComponents({
      before,
      after: after.manifest,
      config,
      changedPaths,
      baseCommit: commit,
      baseRef: "main",
      useFastPath: false,
      useStylePath: false,
      beforeReader: new GitReviewAssetReader(
        config,
        git.reader,
        commit,
        "mockups",
        before,
      ),
      afterReader: new CompiledReviewAssetReader(config, after.outputs),
      cssParser: segments ? native : { parse: (text) => native.parse(text) },
    });
  };
  const expected = await classify(false);
  const actual = await classify(true);
  assert.deepEqual(actual, expected);
  return actual;
}
