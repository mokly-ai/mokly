import assert from "node:assert/strict";
import { test } from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import {
  runWithTimings,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";
import { parseHistoricalManifest } from "../dist/registry/manifest.js";
import type { ReviewResultV4 } from "../packages/viewer/dist/review/component_types.js";

import { assertComparisonPaths } from "./helpers/component_comparison_paths.js";
import { cssAttributionFixture } from "./helpers/css_attribution_fixture.js";

test("Review enabled and forced-complete modes agree for matching shared CSS", async (t) => {
  const fixture = await cssAttributionFixture(t, true, {
    stylesheetMatch: "screens/home.html",
  });
  await fixture.append(".auth { padding: 2px; }");
  const result = await equivalentReview(fixture);

  assert.ok(reasonPaths(result).includes("mockups/shared.css"));
});

test("Review enabled and forced-complete modes agree for owned component CSS", async (t) => {
  const fixture = await cssAttributionFixture(t, true, {
    stylesheetMatch: "components/action-*.html",
    transformSource: (source) =>
      source
        .replace(
          "<button data-viewport=",
          '<button className="owned-action" data-viewport=',
        )
        .replace(
          'id: "action",',
          'id: "action", dependencies: ["mockups/shared.css"], ownedDependencies: ["mockups/shared.css"],',
        ),
  });
  await fixture.append(".owned-action { padding: 2px; }");
  const result = await equivalentReview(fixture, "action-default");

  assert.ok(
    result.changes.some(
      (entry) =>
        entry.kind === "component" &&
        (entry.after ?? entry.before)?.id === "action",
    ),
  );
});

test("Review enabled and forced-complete modes agree for unrelated CSS", async (t) => {
  const fixture = await cssAttributionFixture(t, true, {
    stylesheetMatch: "screens/home.html",
  });
  await fixture.append(".not-present { padding: 2px; }");
  const result = await equivalentReview(fixture);

  assert.deepEqual(reasonPaths(result), []);
  assert.ok(
    result.screens
      .find((screen) => screen.id === "home")!
      .views.every((view) =>
        view.excludedResources?.some(
          (resource) => resource.path === "mockups/shared.css",
        ),
      ),
  );
});

test("Review enabled and forced-complete modes agree for a Git asset-byte change", async (t) => {
  const fixture = await cssAttributionFixture(t, true, {
    stylesheetMatch: "screens/home.html",
  });
  await fixture.append("\nchanged image bytes", "image.svg");
  const result = await equivalentReview(fixture);

  assert.ok(result.changedPaths.includes("mockups/image.svg"));
  assert.ok(reasonPaths(result).includes("mockups/image.svg"));
});

async function equivalentReview(
  fixture: Awaited<ReturnType<typeof cssAttributionFixture>>,
  scenarioId = "home",
): Promise<ReviewResultV4> {
  const events: TimingEvent[] = [];
  const fast = await runWithTimings(true, "test", () => fixture.compare(true), {
    write: (event) => events.push(event),
  });
  const complete = await fixture.compare(false);
  const counts = events.find(
    (event) =>
      event.stage === "review.compare-screens" && event.event === "counts",
  )?.counts;
  assert.ok(Number(counts?.fastPath) > 0);
  assert.deepEqual(fast.result, complete.result);
  assert.equal(fast.result.schemaVersion, 4);
  const files = (side: "before" | "after") => {
    const prefix = `snapshots/${side}/`;
    return new Map(
      [...complete.files].flatMap(([route, content]) =>
        route.startsWith(prefix)
          ? [[route.slice(prefix.length), content] as const]
          : [],
      ),
    );
  };
  await assertComparisonPaths(
    {
      before: parseHistoricalManifest(
        JSON.parse(
          fixture
            .git("show", "main:mockups/mokly-manifest.json")
            .toString("utf8"),
        ),
      ),
      after: (await compileCatalogue(fixture.config)).manifest,
      beforeFiles: files("before"),
      afterFiles: files("after"),
      changedPaths: fast.result.changedPaths,
      config: fixture.config,
    },
    "complete",
    [scenarioId],
  );
  return fast.result;
}

function reasonPaths(result: ReviewResultV4) {
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
