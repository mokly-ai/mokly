import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import type { ReviewResultV3 } from "../packages/viewer/dist/review/component_types.js";

import { cssAttributionFixture } from "./helpers/css_attribution_fixture.js";

test("Review fast and complete paths agree for matching shared CSS", async (t) => {
  const fixture = await cssAttributionFixture(t, true);
  await fixture.append(".auth { padding: 2px; }");
  const result = await equivalentReview(fixture);

  assert.ok(reasonPaths(result).includes("mockups/shared.css"));
});

test("Review fast and complete paths agree for owned component CSS", async (t) => {
  const fixture = await cssAttributionFixture(t, true, {
    prepare: async ({ mockupsDir }) => {
      await fs.writeFile(
        path.join(mockupsDir, "owned.css"),
        ".owned-action {}",
      );
    },
    transformSource: (source) =>
      source
        .replace(
          "<button data-viewport=",
          '<button className="owned-action" data-viewport=',
        )
        .replace('id: "action",', 'id: "action", stylesheets: ["owned.css"],'),
  });
  await fixture.append(".owned-action { padding: 2px; }", "owned.css");
  const result = await equivalentReview(fixture);

  assert.ok(
    result.changes.some(
      (entry) =>
        entry.kind === "component" &&
        (entry.after ?? entry.before)?.id === "action",
    ),
  );
});

test("Review fast and complete paths agree for unrelated CSS", async (t) => {
  const fixture = await cssAttributionFixture(t, true);
  await fixture.append(".not-present { padding: 2px; }");
  const result = await equivalentReview(fixture);

  assert.deepEqual(reasonPaths(result), []);
  assert.ok(
    result.screens
      .flatMap((screen) => screen.views)
      .every((view) =>
        view.excludedResources?.some(
          (resource) => resource.path === "mockups/shared.css",
        ),
      ),
  );
});

test("Review fast and complete paths agree for a Git asset-byte change", async (t) => {
  const fixture = await cssAttributionFixture(t, true);
  await fixture.append("\nchanged image bytes", "image.svg");
  const result = await equivalentReview(fixture);

  assert.ok(result.changedPaths.includes("mockups/image.svg"));
  assert.ok(reasonPaths(result).includes("mockups/image.svg"));
});

async function equivalentReview(
  fixture: Awaited<ReturnType<typeof cssAttributionFixture>>,
): Promise<ReviewResultV3> {
  const fast = await fixture.compare(true);
  const complete = await fixture.compare(false);
  assert.deepEqual(fast.result, complete.result);
  assert.equal(fast.result.schemaVersion, 3);
  return fast.result;
}

function reasonPaths(result: ReviewResultV3) {
  return [
    ...new Set(
      result.changes.flatMap((entry) =>
        entry.reasons.flatMap((reason) =>
          reason.kind === "dependency" ? [reason.path] : [],
        ),
      ),
    ),
  ].sort();
}
