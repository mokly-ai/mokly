import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertFastPathEquivalent,
  compilationFiles,
  type FastPathFixture,
} from "./helpers/component_fast_path.js";
import { componentEntrySource } from "./helpers/component_fixture.js";
import { componentReviewFixture } from "./helpers/component_review_fixture.js";

for (const direction of ["added", "removed"] as const) {
  test(`fast and complete paths agree for ${direction} component views`, async (t) => {
    const full = componentEntrySource();
    const withoutVariant = full.replace(
      ', { slug: "disabled", title: "Disabled", props: { label: "Continue", disabled: true } }',
      "",
    );
    const fixture = await componentReviewFixture(
      t,
      () => (direction === "added" ? full : withoutVariant),
      direction === "added" ? withoutVariant : full,
    );
    const result = await assertFastPathEquivalent(reviewFixture(fixture));
    const variant = result.components
      .find((entry) => entry.path === "action")!
      .variants.find((entry) => entry.path === "action/disabled")!;

    assert.equal(variant.state, direction);
    assert.ok(variant.views.every((view) => view.state === direction));
  });

  test(`fast and complete paths agree for ${direction} screens`, async (t) => {
    const full = componentEntrySource();
    const withoutScreen = full.replace(/ {2}defineScreen\([^\n]+\)\n/, "");
    const fixture = await componentReviewFixture(
      t,
      () => (direction === "added" ? full : withoutScreen),
      direction === "added" ? withoutScreen : full,
    );
    const result = await assertFastPathEquivalent(reviewFixture(fixture));
    const screen = result.screens.find((entry) => entry.path === "home")!;

    assert.equal(screen.state, direction);
    assert.ok(screen.views.every((view) => view.state === direction));
  });
}

function reviewFixture(
  fixture: Awaited<ReturnType<typeof componentReviewFixture>>,
): FastPathFixture {
  return {
    before: fixture.before.manifest,
    after: fixture.after.manifest,
    beforeFiles: compilationFiles(fixture.before),
    afterFiles: compilationFiles(fixture.after),
    changedPaths: fixture.changedPaths,
    config: fixture.config,
  };
}
