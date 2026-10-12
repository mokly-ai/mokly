import assert from "node:assert/strict";
import type { TestContext } from "node:test";

import { generatedResourcePath } from "@mokly/viewer/data";

import {
  runWithDocumentWork,
  runWithTimings,
  timingDocumentWork,
  type TimingEvent,
} from "../../dist/diagnostics/timings.js";
import { compareComponentView } from "../../dist/review/component_view.js";
import { reviewViews } from "../../dist/review/views.js";

import {
  compilationFiles,
  type FastPathFixture,
} from "./component_fast_path.js";
import { componentReviewFixture } from "./component_review_fixture.js";
import { inlineComponentSource } from "./inline_changes.js";
import { pageContext } from "./page_comparison.js";

export async function styleRouteFixture(
  context: TestContext,
  change: (source: string) => string = (source) => source,
  source = inlineComponentSource(),
) {
  const fixture = await componentReviewFixture(context, change, source, "");
  return {
    before: fixture.before.manifest,
    after: fixture.after.manifest,
    beforeFiles: compilationFiles(fixture.before),
    afterFiles: compilationFiles(fixture.after),
    config: fixture.config,
    changedPaths: [],
  } satisfies FastPathFixture;
}

export function withHeadStyles(
  fixture: FastPathFixture,
  before: string,
  after: string,
  _mode: "committed" | "derived",
): FastPathFixture {
  const insert = (files: FastPathFixture["beforeFiles"], markup: string) =>
    new Map(
      [...files].map(([route, source]) => [
        route,
        Buffer.from(source).toString().replace("</head>", `${markup}</head>`),
      ]),
    );
  return {
    ...fixture,
    beforeFiles: insert(fixture.beforeFiles, before),
    afterFiles: insert(fixture.afterFiles, after),
  };
}

export function selectedStyleViews(
  fixture: FastPathFixture,
  id = "home",
  viewPath?: string,
) {
  const entry = fixture.after.entries.find((entry) => entry.path === id)!;
  const previous = fixture.before.entries.find((entry) => entry.path === id)!;
  const after = reviewViews(entry).find(
    (view) =>
      !viewPath ||
      view.path === viewPath ||
      view.path === generatedResourcePath(viewPath),
  )!;
  const before = reviewViews(previous).find(
    (view) => view.path === after.path,
  )!;
  return {
    before,
    after,
    root: "variantOf" in entry ? entry.variantOf : undefined,
  };
}

export async function assertStyleRoute(
  fixture: FastPathFixture,
  expected: "style" | "complete" | "fast",
  id = "home",
  useFastPath = true,
  viewPath?: string,
) {
  const { before, after, root } = selectedStyleViews(fixture, id, viewPath);
  const compare = async (
    useStylePath: boolean,
    useFastPath: boolean,
    useMaterialFingerprints = true,
  ) => {
    const events: TimingEvent[] = [];
    const comparison = await runWithTimings(
      true,
      "test",
      () =>
        runWithDocumentWork(async () => {
          const result = await compareComponentView(
            {
              ...pageContext(fixture),
              useStylePath,
              useFastPath,
              useMaterialFingerprints,
            },
            before,
            after,
            root,
          );
          timingDocumentWork()!.comparedView(result.comparisonPath);
          return result;
        }),
      { write: (event) => events.push(event) },
    );
    return { comparison, events };
  };
  const enabled = await compare(true, useFastPath);
  const text = await compare(false, false, false);
  const { comparisonPath: _textPath, ...textResult } = text.comparison;
  const { comparisonPath: _enabledMaterialPath, ...fingerprintResult } =
    enabled.comparison;
  assert.deepEqual(
    fingerprintResult,
    textResult,
    "delivered M8 text-material oracle",
  );
  assert.equal(enabled.comparison.comparisonPath, expected, after.path);
  for (const oracleFast of [useFastPath, false]) {
    const oracle = await compare(false, oracleFast);
    const { comparisonPath: _enabledPath, ...actual } = enabled.comparison;
    const { comparisonPath: oraclePath, ...complete } = oracle.comparison;
    if (!oracleFast) assert.equal(oraclePath, "complete");
    assert.deepEqual(actual, complete, after.path);
  }
  const counts = (stage: string) =>
    enabled.events.find(
      (event) => event.stage === stage && event.event === "counts",
    )!.counts!;
  const paths = counts("review.compare-screens");
  assert.equal(paths.views, 1);
  assert.equal(paths.stylePath, expected === "style" ? 1 : 0);
  assert.equal(paths.fastPath, expected === "fast" ? 1 : 0);
  assert.equal(paths.completePath, expected === "complete" ? 1 : 0);
  if (expected === "style") {
    const work = counts("review.document-work");
    assert.equal(work["htmlParses.pageAnalysis"], 1);
    assert.equal(
      work.htmlParses,
      1 + Number(work["htmlParses.linkNormalization"] ?? 0),
      "only the original head and the preceding quick check's link rewrites parse",
    );
    assert.equal(work.projectionMs, 0);
    assert.equal(work.hashMs, 0);
  }
  return { ...enabled, counts };
}
