import assert from "node:assert/strict";
import test from "node:test";

import { MaterialMarkerOffsets } from "../dist/review/material_marker_offsets.js";
import { PageAnalysis } from "../dist/review/page_analysis.js";

test("one side reuses its marker-offset index across every material recipe", () => {
  const page = new PageAnalysis(
    '<style>.entry{padding:1px}</style><main class="entry">body</main>',
    "test",
  );
  assert.strictEqual(page.markerOffsets, page.markerOffsets);
});

test("offset queries use only kept openers and complete closes", () => {
  const source = "<!--mokly-review-other-->kept<!--mokly-component:";
  const index = new MaterialMarkerOffsets(source);
  const close = source.indexOf("-->");
  assert.equal(index.openAfter(0, close + 2), true);
  assert.equal(index.openAfter(0, close + 3), false);
  assert.equal(index.openAfter(close + 3, source.length), true);
  assert.equal(index.openAfter(close + 3, close + 7), false);
  assert.equal(index.openAfter(close + 1, close + 3), false);
});
