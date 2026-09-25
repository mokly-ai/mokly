import assert from "node:assert/strict";
import { test } from "node:test";

import { compareReview } from "../dist/review/compare.js";
import { ComponentDependencyPolicy } from "../dist/review/component_metadata.js";
import {
  type DependencyReasonSources,
  validateComponentReviewSources,
} from "../dist/review/component_result_sources.js";
import type { Manifest } from "../packages/viewer/dist/data.js";
import { parseReviewResult } from "../packages/viewer/dist/review/result_validation.js";

import {
  pathCatalogueSource,
  pathEvidenceFixture,
} from "./helpers/component_path_evidence_fixture.js";
import { componentReviewFixture } from "./helpers/component_review_fixture.js";

test("component comparison schemas reject invalid membership, sides, references and unknown fields", async (t) => {
  const fixture = await componentReviewFixture(t, (s) =>
    s.replace(
      "<button data-viewport=",
      '<button className="changed" data-viewport=',
    ),
  );
  const { result } = await compareReview(
    fixture.after,
    fixture.config,
    fixture.git,
    "main",
  );
  assert.equal(result.schemaVersion, 3);
  if (result.schemaVersion !== 3) return;
  assert.deepEqual(
    parseReviewResult(JSON.parse(JSON.stringify(result))),
    result,
  );
  validateComponentReviewSources(
    result,
    fixture.before.manifest,
    fixture.after.manifest,
    new Set(["action"]),
    pathSources(fixture.before.manifest, fixture.after.manifest),
  );
  for (const tamper of [
    (value: typeof result) =>
      Object.assign(value.changes[0]!, { unknown: true }),
    (value: typeof result) => Object.assign(value.changes[0]!, { reasons: [] }),
    (value: typeof result) =>
      Object.assign(value.changes[0]!, { before: undefined, after: undefined }),
    (value: typeof result) =>
      Object.assign(value.components[0]!.variants[0]!.views[0]!, {
        afterPath: "snapshots/after/../secret.html",
      }),
    (value: typeof result) =>
      Object.assign(value.affectedConsumers[0]!, {
        changedComponentId: "unknown",
      }),
    (value: typeof result) =>
      Object.assign(value.affectedConsumers[0]!.evidence[0]!.via[0]!, {
        instanceKey: "invalid",
      }),
    (value: typeof result) =>
      Object.assign(value.changes[0]!, {
        reasons: [{ kind: "dependency", path: "unchanged.txt" }],
      }),
  ]) {
    const value = structuredClone(result);
    tamper(value);
    assert.throws(
      () => parseReviewResult(JSON.parse(JSON.stringify(value))),
      /review/i,
    );
  }
  const invalidSource = structuredClone(result);
  Object.assign(invalidSource.affectedConsumers[0]!.evidence[0]!.via[0]!, {
    instanceKey: "a".repeat(64),
  });
  assert.throws(
    () =>
      validateComponentReviewSources(
        invalidSource,
        fixture.before.manifest,
        fixture.after.manifest,
        new Set(["action"]),
        pathSources(fixture.before.manifest, fixture.after.manifest),
      ),
    /review/i,
  );
  for (const retained of [[], result.affectedConsumers.slice(1)]) {
    assert.throws(
      () =>
        validateComponentReviewSources(
          { ...result, affectedConsumers: retained },
          fixture.before.manifest,
          fixture.after.manifest,
          new Set(["action"]),
          pathSources(fixture.before.manifest, fixture.after.manifest),
        ),
      /review/i,
    );
  }
});

test("source validation rejects a changed path supported only by a shared-impact glob", async (t) => {
  const fixture = await pathEvidenceFixture(t, {
    beforeSource: pathCatalogueSource(),
    changedPaths: [],
    sharedGlobs: ["src/tokens/**"],
  });
  const screen = fixture.result.screens.find((entry) => entry.id === "home")!;
  const tampered = {
    ...fixture.result,
    changedPaths: ["src/tokens/theme.ts"],
    sharedImpact: ["src/tokens/theme.ts"],
    changes: [
      {
        kind: "screen" as const,
        before: screen.before!,
        after: screen.after!,
        reasons: [{ kind: "dependency" as const, path: "src/tokens/theme.ts" }],
      },
    ],
  };

  assert.doesNotThrow(() => parseReviewResult(tampered));
  assert.throws(
    () =>
      validateComponentReviewSources(
        tampered,
        fixture.before.manifest,
        fixture.after.manifest,
        new Set(),
        pathSources(fixture.before.manifest, fixture.after.manifest),
      ),
    /review/i,
  );
});

for (const [name, change] of [
  [
    "saved props",
    (s: string) =>
      s.replace('props: { label: "Continue" }', 'props: { label: "Next" }'),
  ],
  ["controls", (s: string) => s.replace("maxLength: 80", "maxLength: 100")],
] as const)
  test(`source coverage does not invent consumers for ${name}`, async (t) => {
    const fixture = await componentReviewFixture(t, change);
    const { result } = await compareReview(
      fixture.after,
      fixture.config,
      fixture.git,
      "main",
    );
    assert.equal(result.schemaVersion, 3);
    if (result.schemaVersion !== 3) return;
    assert.equal(result.changes.length, 1);
    assert.deepEqual(result.affectedConsumers, []);
    validateComponentReviewSources(
      result,
      fixture.before.manifest,
      fixture.after.manifest,
      new Set(),
      pathSources(fixture.before.manifest, fixture.after.manifest),
    );
  });

/** Policy-only sources: no view or owned-CSS evidence can justify a reason. */
function pathSources(
  before: Manifest,
  after: Manifest,
): DependencyReasonSources {
  return {
    policy: new ComponentDependencyPolicy(before, after, []),
    ownedCss: [],
    viewPaths: new Map(),
  };
}
