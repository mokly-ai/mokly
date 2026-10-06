import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import {
  runWithDocumentWork,
  runWithTimings,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";
import { readBaseManifest } from "../dist/review/base_manifest.js";
import { asChangeEvidence } from "../dist/review/change_evidence.js";
import { classifyComponents } from "../dist/review/component_classification.js";
import { prepareMoveClassification } from "../dist/review/moves/prepare.js";
import { committedReviewRepository } from "../dist/review/repository.js";
import { classifyChangedContent } from "../dist/server/changed_content.js";

import { memoryReader } from "./helpers/component_fast_path.js";
import { componentEntrySource } from "./helpers/component_fixture.js";
import { componentReviewFixture } from "./helpers/component_review_fixture.js";
import { validEntrySource } from "./helpers/fixture.js";
import { inlineChangesFixture } from "./helpers/inline_changes.js";
import { comparePageViews } from "./helpers/page_comparison.js";
import { pageFixtureInput } from "./helpers/page_fixture_inputs.js";

test("either input manifest enables page analysis even when current identities replace all component roots", async (context) => {
  const source = validEntrySource()
    .replaceAll("home", "action")
    .replaceAll("details", "pane");
  const fixture = await componentReviewFixture(context, () => source);
  assert.ok(
    fixture.before.manifest.entries.some((entry) => entry.kind === "component"),
  );
  assert.ok(
    !fixture.after.manifest.entries.some((entry) => entry.kind === "component"),
  );
  const prepared = await prepareMoveClassification({
    before: fixture.before.manifest,
    after: fixture.after.manifest,
    beforeReader: memoryReader(fixture.before.outputs),
    afterReader: memoryReader(fixture.after.outputs),
    changedPaths: fixture.changedPaths,
    config: fixture.config,
    baseCommit: "a".repeat(40),
    baseRef: "main",
  });
  const events: TimingEvent[] = [];
  await runWithTimings(
    true,
    "test",
    () => runWithDocumentWork(() => classifyComponents(prepared)),
    { write: (event) => events.push(event) },
  );
  const counts = events.find(
    ({ stage, event }) =>
      stage === "review.document-work" && event === "counts",
  )!.counts!;
  assert.ok(
    counts["htmlParses.pageAnalysis"]! > 0,
    "scope comes from input manifests, not identity-filtered entries",
  );
  assert.equal(counts["htmlParses.reference"], undefined);
});

for (const mode of ["committed", "derived"] as const)
  test(`component-free shared loop retains delivered ignore-normalized matching and parsing in ${mode}`, async (context) => {
    const source = validEntrySource({
      body: '<div><ReviewIgnore id="context"><i className="ignored" /></ReviewIgnore><b className="subject" /></div>',
    }).replace(
      "defineScreen, defineUseCase",
      "defineScreen, defineUseCase, ReviewIgnore",
    );
    const fixture = await inlineChangesFixture(
      context,
      '<link rel="stylesheet" href="../sheet.css">',
      '<link rel="stylesheet" href="../sheet.css">',
      {
        source,
        colorSchemes: false,
        files: {
          before: { "sheet.css": ".ignored + .subject{color:red}" },
          after: { "sheet.css": ".ignored + .subject{color:blue}" },
        },
      },
    );
    const input = await pageFixtureInput(fixture, mode);
    const events: TimingEvent[] = [];
    const result = await runWithTimings(
      true,
      "test",
      () =>
        runWithDocumentWork(() =>
          classifyComponents({
            ...input,
            beforeReader: memoryReader(input.beforeFiles),
            afterReader: memoryReader(input.afterFiles),
            baseCommit: "a".repeat(40),
            baseRef: "main",
          }),
        ),
      { write: (event) => events.push(event) },
    );
    assert.deepEqual(result.changes, []);
    for (const { comparison, path } of await comparePageViews(input, true))
      assert.equal(comparison.view.state, "unchanged", path);
    const counts = events.find(
      ({ stage, event }) =>
        stage === "review.document-work" && event === "counts",
    )!.counts!;
    assert.equal(counts["htmlParses.pageAnalysis"], undefined);
    assert.ok(counts["htmlParses.stylesheetMatching"]! > 0);
  });

for (const mode of ["committed", "derived"] as const)
  test(`component-catalogue page pass keeps its own cache and ignore-normalized matcher in ${mode}`, async (context) => {
    const source =
      componentEntrySource().replace(
        "defineComponent, defineScreen",
        "defineComponent, definePage, defineScreen",
      ) +
      `
mockups.push(definePage({ path: "guide", title: "Guide", description: "Page path", dependencies: [], relatedDocs: [], render: () => '<!doctype html><html><head><link rel="stylesheet" href="../sheet.css"></head><body><div><!--mokly-review-ignore:start:context--><i class="ignored"></i><!--mokly-review-ignore:end:context--><b class="subject"></b></div></body></html>' }));`;
    const fixture = await inlineChangesFixture(context, "", "", {
      source,
      colorSchemes: false,
      files: {
        before: { "sheet.css": ".ignored + .subject{color:red}" },
        after: { "sheet.css": ".ignored + .subject{color:blue}" },
      },
    });
    const config = { ...fixture.config, generatedOutput: mode };
    const git = committedReviewRepository(fixture.config);
    const commit = fixture.git("rev-parse", "HEAD").toString().trim();
    const before = await readBaseManifest(git.reader, commit, config);
    const after = await compileCatalogue(config);
    const events: TimingEvent[] = [];
    const result = await runWithTimings(
      true,
      "test",
      () =>
        runWithDocumentWork(() =>
          classifyChangedContent(
            after.manifest,
            before,
            config,
            git.reader,
            commit,
            asChangeEvidence(["mockups/sheet.css"]),
            undefined,
            "pages",
          ),
        ),
      { write: (event) => events.push(event) },
    );
    assert.deepEqual(result.changedPaths, []);
    const counts = events.find(
      ({ stage, event }) =>
        stage === "review.document-work" && event === "counts",
    )!.counts!;
    assert.equal(counts["htmlParses.pageAnalysis"], undefined);
    assert.ok(counts["htmlParses.legacyStylesheetMatching"]! > 0);
    assert.equal(
      await fs.readFile(path.join(config.mockupsDir, "sheet.css"), "utf8"),
      ".ignored + .subject{color:blue}",
    );
  });
