import assert from "node:assert/strict";
import test from "node:test";

import { renderReviewArtifact } from "../dist/review/artifact.js";
import { parseReviewResult } from "../packages/viewer/dist/review/result_validation.js";

import {
  cssSchemaFiles,
  cssSchemaFixture,
} from "./helpers/review_css_schema.js";

for (const version of [2, 3] as const) {
  test(`v${version} validates material even without resource evidence`, () => {
    const result = cssSchemaFixture(version);
    for (const view of result.screens[0]!.views) {
      delete view.reasons;
      delete view.excludedResources;
    }
    assert.deepEqual(parseReviewResult(result), result);
    const files = renderReviewArtifact({ result, files: cssSchemaFiles() });
    assert.deepEqual(
      parseReviewResult(JSON.parse(String(files.get("review.json")))),
      result,
    );
    Object.assign(result.screens[0]!.views[0]!, { material: false });
    assert.throws(
      () => renderReviewArtifact({ result, files: cssSchemaFiles() }),
      /material/,
    );
  });
  test(`v${version} artifact validation rejects unreachable exclusion evidence`, () => {
    const result = cssSchemaFixture(version);
    Object.assign(result, {
      changedPaths: ["mockups/shared.css", "mockups/unreachable.css"],
    });
    Object.assign(result.screens[0]!.views[1]!, {
      excludedResources: [
        { path: "mockups/unreachable.css", reason: "no-matching-rule" },
      ],
    });
    assert.throws(
      () => renderReviewArtifact({ result, files: cssSchemaFiles() }),
      /not reachable/,
    );
  });
  test(`v${version} CSS evidence round-trips through the artifact and shared client decoder`, () => {
    const result = cssSchemaFixture(version);
    const files = renderReviewArtifact({ result, files: cssSchemaFiles() });
    const json = String(files.get("review.json"));
    const decoded = parseReviewResult(JSON.parse(json));
    assert.deepEqual(decoded, result);
    assert.equal(
      renderReviewArtifact({ result: decoded, files: cssSchemaFiles() }).get(
        "review.json",
      ),
      json,
    );
    const historical = structuredClone(result);
    for (const view of historical.screens[0]!.views) {
      delete view.reasons;
      delete view.excludedResources;
      delete view.material;
    }
    assert.deepEqual(parseReviewResult(historical), historical);
  });

  for (const [name, patch] of [
    ["unsorted selectors", { status: "matched", selectors: [".z", ".a"] }],
    ["duplicate selectors", { status: "matched", selectors: [".a", ".a"] }],
    ["missing matched selectors", { status: "matched", selectors: [] }],
    ["invalid status", { status: "excluded", selectors: [".a"] }],
    [
      "unknown analysis fields",
      { status: "matched", selectors: [".a"], extra: true },
    ],
  ] as const)
    test(`v${version} rejects ${name} on both dependency boundaries`, () => {
      const value = cssSchemaFixture(version);
      Object.assign(value.screens[0]!.views[0]!.reasons![0]!, {
        analysis: patch,
      });
      assert.throws(() => parseReviewResult(value), /review/);
      if (version === 3) {
        const entry = cssSchemaFixture(3);
        assert.ok(entry.schemaVersion === 3);
        Object.assign(entry.changes[0]!, {
          reasons: [
            { kind: "dependency", path: "mockups/shared.css", analysis: patch },
          ],
        });
        assert.throws(() => parseReviewResult(entry), /review/);
      }
    });

  for (const [name, patch] of [
    ["false material", { material: false }],
    ["string material", { material: "true" }],
    ["unchanged material", { material: true, state: "unchanged" }],
    ["ignored-only material", { material: true, state: "ignored-only" }],
    [
      "unchanged exclusion",
      {
        excludedResources: [
          { path: "mockups/other.css", reason: "no-matching-rule" },
        ],
      },
    ],
    [
      "non-CSS exclusion",
      {
        excludedResources: [{ path: "image.svg", reason: "no-matching-rule" }],
      },
    ],
    [
      "duplicate exclusions",
      {
        excludedResources: [
          { path: "mockups/shared.css", reason: "no-matching-rule" },
          { path: "mockups/shared.css", reason: "no-matching-rule" },
        ],
      },
    ],
    [
      "conflicting reasons",
      { reasons: [{ kind: "dependency", path: "mockups/shared.css" }] },
    ],
    ["empty exclusions", { excludedResources: [] }],
    ["empty reasons", { reasons: [] }],
    [
      "unknown exclusion fields",
      {
        excludedResources: [
          {
            path: "mockups/shared.css",
            reason: "no-matching-rule",
            extra: true,
          },
        ],
      },
    ],
  ] as const)
    test(`v${version} rejects ${name}`, () => {
      const value = cssSchemaFixture(version);
      Object.assign(value.screens[0]!.views[1]!, patch);
      assert.throws(() => parseReviewResult(value), /review/);
    });

  test(`v${version} permits unresolved empty selectors only on CSS`, () => {
    const value = cssSchemaFixture(version);
    Object.assign(value.screens[0]!.views[0]!.reasons![0]!, {
      analysis: { status: "unresolved", selectors: [] },
    });
    assert.deepEqual(parseReviewResult(value), value);
    Object.assign(value, { changedPaths: ["image.svg"] });
    Object.assign(value.screens[0]!.views[0]!.reasons![0]!, {
      path: "image.svg",
    });
    delete value.screens[0]!.views[1]!.excludedResources;
    assert.throws(
      () => parseReviewResult(value),
      /analysis requires a stylesheet/,
    );
  });
}
