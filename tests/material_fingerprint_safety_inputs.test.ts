import assert from "node:assert/strict";
import test from "node:test";

import { prepareComponentProjection } from "../dist/review/component_projection_resources.js";
import { compareUnchangedComponentView } from "../dist/review/component_view_fast_path.js";
import { PageAnalysis } from "../dist/review/page_analysis.js";
import { PageAnalysisPair } from "../dist/review/page_pair.js";

import { inlineChangesFixture } from "./helpers/inline_changes.js";
import { pageContext } from "./helpers/page_comparison.js";
import { pageFixtureInput } from "./helpers/page_fixture_inputs.js";
import { selectedStyleViews } from "./helpers/style_route.js";

const view = {
  path: "home/index.html",
  viewport: "mobile",
  colorScheme: "light",
} as const;
const style = "<style>.entry{color:red}</style>";

test("source-safety proofs require both exact ordered guard inputs and snapshot them", () => {
  const source = style + style.replace("red", "blue");
  const original = new PageAnalysis(source, "test").inlineStyles([]);
  const pages = new PageAnalysisPair(view, view, source, source);
  assert.equal(pages.hasStyleSafetyProof(original, original), false);
  const inputs = original.map((span) => ({ ...span }));
  pages.rememberStyleSafety(inputs);
  assert.equal(pages.hasStyleSafetyProof(original, original), true);
  assert.equal(
    pages.hasStyleSafetyProof([...original].reverse(), original),
    false,
  );
  assert.equal(pages.hasStyleSafetyProof(original, []), false);
  const changedSource = original.map((span) => ({
    ...span,
    source: span.source + " ",
  }));
  const changedText = original.map((span) => ({
    ...span,
    text: span.text + " ",
  }));
  for (const changed of [changedSource, changedText]) {
    assert.equal(pages.hasStyleSafetyProof(changed, original), false);
    assert.equal(pages.hasStyleSafetyProof(original, changed), false);
  }
  inputs[0]!.text += " changed after recording";
  assert.equal(pages.hasStyleSafetyProof(original, original), true);
  assert.equal(pages.hasStyleSafetyProof(inputs, original), false);
  assert.equal(
    new PageAnalysisPair(view, view, source, source).hasStyleSafetyProof(
      original,
      original,
    ),
    false,
    "never reuse across views",
  );
});

for (const mode of ["committed", "derived"] as const)
  test(`${mode} missing proof and disabled switches still run the complete guard`, async (context) => {
    const fixture = await inlineChangesFixture(
      context,
      `<link rel="stylesheet" href="../shared.css">${style}`,
      `<link rel="stylesheet" href="../shared.css">${style}`,
      {
        colorSchemes: false,
        files: {
          before: { "shared.css": ".missing{color:red}" },
          after: { "shared.css": ".missing{color:blue}" },
        },
      },
    );
    const input = await pageFixtureInput(fixture, mode);
    const { before, after, root } = selectedStyleViews(input);
    const base = Buffer.from(input.beforeFiles.get(before.path)!).toString();
    const head = Buffer.from(input.afterFiles.get(after.path)!).toString();
    for (const record of [false, true])
      for (const useFastPath of [true, false])
        for (const useStylePath of [true, false])
          await context.test(
            `recorded=${record}, fast=${useFastPath}, style=${useStylePath}`,
            async (test) => {
              const pages = new PageAnalysisPair(before, after, base, head);
              const comparison = pageContext(input);
              if (record) {
                const attempt = await compareUnchangedComponentView(
                  comparison,
                  before,
                  after,
                  {
                    viewport: after.viewport,
                    colorScheme: after.colorScheme,
                    state: "unchanged",
                    ignoredIds: [],
                  },
                  base,
                  head,
                  root,
                  pages,
                );
                assert.equal(attempt.comparison, undefined);
                const spans = pages.afterAnalysis.inlineStyles(
                  pages.pairedIgnoreIds,
                );
                assert.equal(pages.hasStyleSafetyProof(spans, spans), true);
              }
              let scans = 0;
              const includes = String.prototype.includes;
              test.mock.method(
                String.prototype,
                "includes",
                function (this: string, needle: string, start?: number) {
                  if (String(this) === style && needle === "<!--mokly-review-")
                    scans++;
                  return includes.call(this, needle, start);
                },
              );
              const prepared = prepareComponentProjection(
                { ...comparison, useFastPath, useStylePath },
                before,
                after,
                base,
                head,
                root,
                {},
                pages,
              );
              assert.equal(prepared.inlineAnalysis?.status, "skipped");
              assert.ok(
                prepared.projected.actual.head.includes(
                  "<!--mokly-inline-style:",
                ),
              );
              assert.equal(
                scans,
                record && useFastPath && useStylePath ? 0 : 2,
              );
            },
          );
  });
