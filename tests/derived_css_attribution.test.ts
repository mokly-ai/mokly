import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { compareReview } from "../dist/review/compare.js";
import { prepareReviewRepository } from "../dist/review/prepare.js";
import { RepositorySelectedReview } from "../dist/review/selected.js";
import { computeCatalogueChanges } from "../dist/server/changed.js";
import { parseReviewResult } from "../packages/viewer/dist/review/result_validation.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { resourceReasonSummaries } from "./helpers/css_evidence.js";
import { derivedFixture } from "./helpers/derived_fixture.js";
import { validEntrySource } from "./helpers/fixture.js";

for (const components of [false, true]) {
  test(`derived CSS evidence keeps rule attribution across live and retained comparisons (components=${components})`, async (t) => {
    const markup =
      '<link rel="stylesheet" href="../shared.css" /><button className="auth">Sign in</button>';
    const source = components
      ? componentEntrySource({ actionRender: `() => <>${markup}</>` })
      : validEntrySource({ body: markup });
    const fixture = await derivedFixture(t, source, {
      "shared.css": ".auth { color: black; } .guide { color: black; }",
      "components/shared.css":
        ".auth { color: black; } .guide { color: black; }",
    });
    const repository = await prepareReviewRepository(fixture.config, "HEAD");
    const cssPaths = ["shared.css", "components/shared.css"].map((route) =>
      path.join(fixture.mockupsDir, route),
    );
    const evidencePath = "mockups/shared.css";
    const current = await compileCatalogue(fixture.config);
    const id = components ? "action-default" : "home";
    for (const [rule, expectedState] of [
      [".guide { padding: 2px; }", "unchanged"],
      [".auth { padding: 3px; }", "changed"],
    ] as const) {
      for (const cssPath of cssPaths) await fs.appendFile(cssPath, rule);
      const live = await computeCatalogueChanges(
        fixture.config,
        "HEAD",
        repository,
      );
      assert.equal(live.changedIds?.includes(id), expectedState === "changed");
      const complete = await compareReview(
        current,
        fixture.config,
        repository,
        "HEAD",
      );
      parseReviewResult(complete.result);
      const snapshot = live.componentChanges!;
      const selected = await new RepositorySelectedReview(
        fixture.config,
        repository.reader,
      ).generate(
        {
          ...snapshot.comparison!,
          before: snapshot.baseline,
          after: current.manifest,
          result: snapshot.result!,
        },
        { id },
        new AbortController().signal,
      );
      const result = parseReviewResult(selected.result);
      const views =
        components && result.schemaVersion === 5
          ? result.components[0]!.variants[0]!.views
          : result.screens.find((screen) => screen.id === id)!.views;
      assert.ok(views.length > 0);
      for (const view of views) {
        assert.equal(view.state, expectedState);
        if (expectedState === "unchanged")
          assert.deepEqual(view.excludedResources, [
            { path: evidencePath, reason: "no-matching-rule" },
          ]);
        else
          assert.deepEqual(resourceReasonSummaries(view.reasons), [
            {
              kind: "dependency",
              path: evidencePath,
              analysis: { status: "matched", selectors: [".auth"] },
            },
          ]);
      }
    }
  });
}
