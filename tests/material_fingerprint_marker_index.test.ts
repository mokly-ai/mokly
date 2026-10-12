import assert from "node:assert/strict";
import test from "node:test";

import { FingerprintSourceProofs } from "../dist/review/fingerprint_source_proofs.js";
import { MaterialMarkerOffsets } from "../dist/review/material_marker_offsets.js";

test("one side reuses its marker-offset index across every material recipe", () => {
  const source =
    '<style>.entry{padding:1px}</style><main class="entry">body</main>';
  const proofs = new FingerprintSourceProofs(source, source);
  assert.strictEqual(
    proofs.markerOffsets("before"),
    proofs.markerOffsets("before"),
  );
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
