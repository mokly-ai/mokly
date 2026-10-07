import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  assertFingerprintComparison,
  comparisonMaterials,
  fingerprintMaterials,
} from "./helpers/fingerprint_comparison.js";
import { styleRouteFixture, withHeadStyles } from "./helpers/style_route.js";

test("whole-view reserved-prefix fallback retains exact M8 bytes", async (context) => {
  const fixture = await styleRouteFixture(context);
  const style = '<style data-id="whole">.entry{color:red}</style>';
  const digest = createHash("sha256").update(style).digest("base64url");
  for (const location of ["base", "head", "both"] as const)
    for (const marker of [
      "<p>ordinary mokly-inline-text</p>",
      `<!--mokly-inline-style:${digest}-->`,
      "<!--mokly-inline-rules:47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU-->",
    ])
      for (const move of [false, true])
        await context.test(`${location}, move=${move}: ${marker}`, async () => {
          const baseMarker = location === "head" ? "" : marker;
          const headMarker = location === "base" ? "" : marker;
          const input = withHeadStyles(
            fixture,
            style + baseMarker,
            move
              ? headMarker + style
              : style.replace("red", "blue") + headMarker,
          );
          const actual = fingerprintMaterials(input);
          const text = fingerprintMaterials(input, false);
          assert.deepEqual(actual.projected, text.projected);
          assert.deepEqual(actual.references, text.references);
          assert.deepEqual(
            comparisonMaterials(actual),
            comparisonMaterials(text),
          );
          await assertFingerprintComparison(input);
        });
});
