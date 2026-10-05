import assert from "node:assert/strict";
import test from "node:test";

import { PageAnalysis } from "../dist/review/page_analysis.js";

import {
  comparisonMaterials,
  fingerprintMaterials,
} from "./helpers/fingerprint_comparison.js";
import { inlineChangesFixture } from "./helpers/inline_changes.js";
import { pageFixtureInput } from "./helpers/page_fixture_inputs.js";
import { selectedStyleViews } from "./helpers/style_route.js";

const style = "<style>.entry{color:red}</style>";
const markerPattern = "<!--mokly-(?:review-|component:)|<!--mokly-|-->";

for (const mode of ["committed", "derived"] as const)
  test(`${mode} complete view indexes and checks identical original sources once`, async (context) => {
    const fixture = await inlineChangesFixture(context, style, style, {
      colorSchemes: false,
    });
    const input = await pageFixtureInput(fixture, mode);
    const { before, after } = selectedStyleViews(input);
    const source = Buffer.from(input.beforeFiles.get(before.path)!).toString();
    assert.equal(
      source,
      Buffer.from(input.afterFiles.get(after.path)!).toString(),
    );
    const spans = new PageAnalysis(
      source,
      before.path,
      before.usage,
    ).inlineStyles([]);
    assert.equal(spans.length, 1);
    assert.equal(spans[0]!.source, style);
    let markers = 0;
    let styles = 0;
    let occurrences = 0;
    const matchAll = String.prototype.matchAll;
    const indexOf = String.prototype.indexOf;
    context.mock.method(
      String.prototype,
      "matchAll",
      function (this: string, pattern: RegExp) {
        if (String(this) === source) {
          if (pattern.source === markerPattern) markers++;
          if (pattern.source === "<style" && pattern.flags === "gi") styles++;
        }
        return matchAll.call(this, pattern);
      },
    );
    context.mock.method(
      String.prototype,
      "indexOf",
      function (this: string, needle: string, start?: number) {
        if (String(this) === source && needle === style) occurrences++;
        return indexOf.call(this, needle, start);
      },
    );
    const prepared = fingerprintMaterials(input);
    assert.equal(prepared.inlineAnalysis?.status, "skipped");
    for (const material of comparisonMaterials(prepared))
      assert.ok(material.includes("<!--mokly-inline-style:"));
    assert.equal(markers, 1, "one marker index for the exact source");
    assert.equal(styles, 1, "one style index for the same skipped sources");
    assert.equal(occurrences, 2, "one occurrence traversal, including its end");
  });
