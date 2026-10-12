import assert from "node:assert/strict";
import test from "node:test";

import { inlineChangesFixture } from "./helpers/inline_changes.js";
import { comparePageViews } from "./helpers/page_comparison.js";
import { pageFixtureInput } from "./helpers/page_fixture_inputs.js";

for (const mode of ["committed", "derived"] as const)
  test(`referenced HTML keeps delivered normalized reference discovery in ${mode}`, async (context) => {
    const frame =
      '<!--mokly-review-ignore:start:wrapper--><select><!--mokly-review-ignore:end:wrapper--><img src="image.svg">';
    const fixture = await inlineChangesFixture(
      context,
      '<iframe src="../frame.html"></iframe>',
      '<iframe src="../frame.html"></iframe>',
      {
        colorSchemes: false,
        files: {
          before: { "frame.html": frame, "image.svg": "before" },
          after: { "frame.html": frame, "image.svg": "after" },
        },
      },
    );
    const input = await pageFixtureInput(fixture, mode);
    const current = await comparePageViews(input);
    const old = await comparePageViews(input, true);
    for (const { entryId, path, comparison } of current.filter(
      ({ entryId }) => entryId === "home",
    )) {
      const delivered = old.find(
        (result) => result.entryId === entryId && result.path === path,
      )!.comparison;
      assert.equal(
        delivered.view.state,
        "changed",
        "resource-reader normalization exposes the image by removing the ignored select opener",
      );
      assert.deepEqual(comparison.view, delivered.view, path);
      assert.deepEqual(comparison.reasons, delivered.reasons, path);
      assert.equal(comparison.comparisonPath, "complete", path);
    }
  });
