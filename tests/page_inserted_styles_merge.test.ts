import assert from "node:assert/strict";
import { test } from "node:test";

import { Parser } from "parse5";

import { componentUsageTopologyEqual } from "../src/components/comparison_material.js";
import {
  runWithDocumentWork,
  runWithTimings,
  type TimingEvent,
} from "../src/diagnostics/timings.js";

import {
  compareMergedPage,
  mergedPage,
} from "./helpers/merged_page_fixture.js";

const switches = [
  { useFastPath: false, useStylePath: false },
  { useFastPath: false, useStylePath: true },
  { useFastPath: true, useStylePath: false },
  { useFastPath: true, useStylePath: true },
];

test("inserted-link topology ignores coordinate shifts", () => {
  const before = mergedPage(
    "sheet.css",
    false,
    "<style>.entry{color:red}</style>",
  );
  const after = mergedPage(
    "sheet.css",
    false,
    "<style>.entry{color:blue}</style>",
  );
  assert.equal(
    componentUsageTopologyEqual(before.view.usage, after.view.usage),
    true,
  );
});

for (const ignored of [false, true])
  test(`inserted-link removal composes in original coordinates, ignored=${ignored}`, async () => {
    const before = mergedPage("before.css", ignored);
    const after = mergedPage("after.css", ignored);
    const files = {
      before: {
        "before.css": ".missing{color:red}",
        "after.css": ".missing{color:red}",
      },
      after: {
        "before.css": ".missing{color:red}",
        "after.css": ".missing{color:red}",
      },
    };
    const paths = ["mockups/before.css", "mockups/after.css"];
    const oracle = await compareMergedPage(before, after, files, paths, {
      useFastPath: false,
      useStylePath: false,
      useMaterialFingerprints: false,
    });
    assert.deepEqual(oracle.reasons, []);
    assert.equal(oracle.view.material, undefined);
    for (const setting of switches) {
      const actual = await compareMergedPage(
        before,
        after,
        files,
        paths,
        setting,
      );
      assert.deepEqual({ ...actual, comparisonPath: "complete" }, oracle);
    }
  });

for (const ignored of [false, true])
  test(`inserted CSS participates in original-tree rule matching, ignored=${ignored}`, async () => {
    const page = mergedPage("sheet.css", ignored);
    page.source = page.source.replace(
      "<main",
      '<!--mokly-review-ignore:start:adjacent--><i class="sibling"></i><!--mokly-review-ignore:end:adjacent--><main',
    );
    const files = {
      before: { "sheet.css": ".sibling + .entry{color:red}" },
      after: { "sheet.css": ".sibling + .entry{color:blue}" },
    };
    const paths = ["mockups/sheet.css"];
    const oracle = await compareMergedPage(page, page, files, paths, {
      useFastPath: false,
      useStylePath: false,
      useMaterialFingerprints: false,
    });
    assert.equal(oracle.view.reasons?.[0]?.analysis?.status, "matched");
    for (const setting of switches) {
      const actual = await compareMergedPage(page, page, files, paths, setting);
      assert.deepEqual({ ...actual, comparisonPath: "complete" }, oracle);
    }
  });

for (const mode of ["identical", "style", "linked"] as const)
  test(`inserted-link ${mode} comparison counts every parse and reuses original pages`, async (t) => {
    const raw = Parser.parse;
    let parses = 0;
    t.mock.method(
      Parser,
      "parse",
      function (this: typeof Parser, ...args: Parameters<typeof raw>) {
        parses++;
        return Reflect.apply(raw, this, args);
      },
    );
    const before = mergedPage(
      "sheet.css",
      true,
      "<style>.entry{color:red}</style>",
    );
    const after =
      mode === "style"
        ? mergedPage("sheet.css", true, "<style>.entry{color:blue}</style>")
        : before;
    const files = {
      before: { "sheet.css": ".entry{color:red}" },
      after: {
        "sheet.css": `.entry{color:${mode === "linked" ? "blue" : "red"}}`,
      },
    };
    const events: TimingEvent[] = [];
    const result = await runWithTimings(
      true,
      "merge-test",
      () =>
        runWithDocumentWork(() =>
          compareMergedPage(
            before,
            after,
            files,
            mode === "linked" ? ["mockups/sheet.css"] : [],
          ),
        ),
      { write: (event) => events.push(event) },
    );
    const counts = events.find(
      ({ stage, event }) =>
        stage === "review.document-work" && event === "counts",
    )!.counts!;
    assert.equal(
      result.comparisonPath,
      mode === "identical" ? "fast" : mode === "style" ? "style" : "complete",
    );
    assert.equal(parses, counts.htmlParses, "every parse is counted");
    assert.equal(counts["htmlParses.pageAnalysis"], mode === "linked" ? 2 : 1);
    assert.equal(
      parses - (counts["htmlParses.linkNormalization"] ?? 0),
      mode === "linked" ? 2 : 1,
    );
  });

test("inserted CSS route membership alone adds no byte-only material reason", async () => {
  const before = mergedPage("before.css");
  const after = mergedPage("after.css");
  const shared = {
    "before.css": ".entry{color:red}",
    "after.css": ".entry{color:red}",
  };
  const result = await compareMergedPage(
    before,
    after,
    { before: shared, after: shared },
    [],
    { useFastPath: false, useStylePath: false },
  );
  assert.deepEqual(result.reasons, []);
  assert.equal(result.view.state, "unchanged");
});
