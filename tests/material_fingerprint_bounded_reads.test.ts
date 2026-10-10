import assert from "node:assert/strict";
import test from "node:test";

import type { MaterialRecipe } from "../dist/components/material_recipe.js";
import { fingerprintAtSeam } from "../dist/review/fingerprint_seams.js";
import { MaterialMarkerOffsets } from "../dist/review/material_marker_offsets.js";
import { StyleSeamOffsets } from "../dist/review/style_seam_offsets.js";

import { observeFingerprintReads } from "./helpers/fingerprint_window_spy.js";

test("after indexing, all string/regexp reads stay in bounded windows over 1 MiB pieces", () => {
  const styles = ["x", "y"].map(
    (value) => `<style>.entry{--x:${value.repeat(1024 * 1024)}}</style>`,
  );
  const marker =
    "<!--mokly-component:start:r-1--><!--mokly-component:end:r-1-->";
  const source = styles[0]! + marker + styles[1]!;
  const second = styles[0]!.length + marker.length;
  const recipes: MaterialRecipe[] = [
    [
      { kind: "source", start: 0, end: styles[0]!.length },
      { kind: "source", start: second, end: source.length },
    ],
    [
      { kind: "source", start: 0, end: 500_000 },
      { kind: "source", start: 500_001, end: source.length },
      {
        kind: "insert",
        text: '<mokly-caller-slot data-rendered="true">',
        references: [],
      },
    ],
  ];
  const offsets = new MaterialMarkerOffsets(source);
  const index = new StyleSeamOffsets(source, styles);
  for (const recipe of recipes) {
    const expected = fingerprintAtSeam(source, recipe, offsets, index);
    let actual: boolean | undefined;
    const observed = observeFingerprintReads(source, recipe, () => {
      actual = fingerprintAtSeam(source, recipe, offsets, index);
    });
    assert.equal(actual, expected);
    assert.ok(observed.calls > 0, "the spies must see actual window work");
    assert.deepEqual(observed.violations, []);
  }
});
