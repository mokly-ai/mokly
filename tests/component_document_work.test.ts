import assert from "node:assert/strict";
import test from "node:test";

import {
  runWithDocumentWork,
  runWithTimings,
  timingDocumentWork,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";
import { classifyComponents } from "../dist/review/component_classification.js";
import { ComponentMaterialReader } from "../dist/review/component_resources.js";
import { compareComponentView } from "../dist/review/component_view.js";
import { catalogueLinkNormalizer } from "../dist/review/moves/links.js";
import { ResourceComparison } from "../dist/review/resource_comparison.js";
import { reviewViews as generatedViews } from "../dist/review/views.js";

import { compilationFiles } from "./helpers/component_fast_path.js";
import { componentReviewFixture } from "./helpers/component_review_fixture.js";
import { textOutput } from "./helpers/generated_text.js";

test("disabled classification creates and retains no document counter state", async (testContext) => {
  const fixture = await componentReviewFixture(testContext, (source) => source);
  const events: TimingEvent[] = [];
  const reader = (outputs: ReadonlyMap<string, string | Uint8Array>) => ({
    read: async (route: string) => {
      assert.equal(timingDocumentWork(), undefined);
      return Buffer.from(textOutput(outputs, route)!);
    },
  });
  await runWithTimings(
    false,
    "test",
    () =>
      classifyComponents({
        before: fixture.before.manifest,
        after: fixture.after.manifest,
        beforeReader: reader(fixture.before.outputs),
        afterReader: reader(fixture.after.outputs),
        config: fixture.config,
        changedPaths: [],
        baseCommit: "a".repeat(40),
        baseRef: "main",
      }),
    { write: (event) => events.push(event) },
  );
  assert.equal(timingDocumentWork(), undefined);
  assert.deepEqual(events, []);
});

for (const full of [false, true])
  test(`document counters pin every parse step for one ${full ? "complete" : "fast"} view`, async (testContext) => {
    const fixture = await componentReviewFixture(
      testContext,
      full
        ? (source) => source.replace("Screen content", "Edited screen content")
        : (source) => source,
    );
    const reader = (outputs: ReadonlyMap<string, string | Uint8Array>) =>
      new ComponentMaterialReader({
        read: async (route: string) => Buffer.from(outputs.get(route)!),
        readIfExists: async (route: string) =>
          outputs.has(route) ? Buffer.from(outputs.get(route)!) : undefined,
      });
    const files = (side: typeof fixture.before, color: string) => {
      const outputs = new Map(compilationFiles(side));
      if (full) {
        const selected = generatedViews(
          side.manifest.entries.find(({ path: id }) => id === "home")!,
        )[0]!;
        outputs.set(
          selected.path,
          Buffer.from(outputs.get(selected.path)!)
            .toString()
            .replace(
              "</head>",
              `<style>main{color:${color}}</style><link rel="stylesheet" href="../../sheet.css"></head>`,
            )
            .replace(
              "</body>",
              '<iframe src="../../embedded.html"></iframe></body>',
            ),
        );
        outputs.set("sheet.css", `main{background:${color}}`);
        outputs.set(
          "embedded.html",
          "<!doctype html><html><body><main>Embedded</main></body></html>",
        );
      }
      return outputs;
    };
    const beforeReader = reader(files(fixture.before, "red"));
    const afterReader = reader(files(fixture.after, "blue"));
    const changed = new Set(full ? ["mockups/sheet.css"] : []);
    const context = {
      componentAware: true,
      links: catalogueLinkNormalizer(
        fixture.before.manifest.entries,
        fixture.after.manifest.entries,
        [],
      ),
      beforeReader,
      afterReader,
      changed,
      prefix: "mockups",
      resources: new ResourceComparison(
        beforeReader,
        afterReader,
        changed,
        "mockups",
        undefined,
        undefined,
        true,
      ),
    };
    const view = (side: typeof fixture.before) =>
      generatedViews(
        side.manifest.entries.find(({ path: id }) => id === "home")!,
      )[0]!;
    const events: TimingEvent[] = [];
    await runWithTimings(
      true,
      "test",
      () =>
        runWithDocumentWork(async () => {
          const result = await compareComponentView(
            context,
            view(fixture.before),
            view(fixture.after),
          );
          assert.equal(result.comparisonPath, full ? "complete" : "fast");
          timingDocumentWork()!.comparedView(result.comparisonPath);
        }),
      { write: (event) => events.push(event) },
    );
    const work = events.find(
      ({ stage, event }) =>
        stage === "review.document-work" && event === "counts",
    )!.counts!;
    const steps = Object.fromEntries(
      Object.entries(work).filter(([key]) => key.startsWith("htmlParses.")),
    );
    assert.deepEqual(
      steps,
      full
        ? {
            "htmlParses.pageAnalysis": 2,
            "htmlParses.linkNormalization": 24,
            "htmlParses.resourceReference": 2,
          }
        : { "htmlParses.pageAnalysis": 1 },
    );
    assert.equal(
      work.htmlParses,
      Object.values(steps).reduce((total, count) => total + count, 0),
    );
    assert.equal(timingDocumentWork(), undefined);
  });
