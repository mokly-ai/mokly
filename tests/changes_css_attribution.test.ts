import assert from "node:assert/strict";
import test from "node:test";

import { renderReviewArtifact } from "../dist/review/artifact.js";
import { committedReviewRepository } from "../dist/review/repository.js";
import { computeCatalogueChanges } from "../dist/server/changed.js";
import { parseReviewResult } from "../packages/viewer/dist/review/result_validation.js";

import { cssAttributionFixture } from "./helpers/css_attribution_fixture.js";

for (const components of [false, true]) {
  for (const [name, css, included, status] of [
    ["guide rule", ".guide { padding: 2px; }", false, "matched"],
    ["auth rule", ".auth { padding: 2px; }", true, "matched"],
    ["custom property", ".guide { --tone: red; }", true, "unresolved"],
    ["formatting only", "\n", false, undefined],
  ] as const) {
    test(`CSS attribution v${components ? 3 : 2}: ${name} agrees across all views and live membership`, async (t) => {
      const fixture = await cssAttributionFixture(t, components);
      await fixture.append(css);
      const live = await computeCatalogueChanges(
        fixture.config,
        "main",
        committedReviewRepository(fixture.config),
      );
      assert.equal(live.changedRoutes?.includes("screens/home.html"), included);
      const artifact = await fixture.compare();
      const screen = artifact.result.screens.find(
        (entry) => entry.id === "home",
      )!;
      assert.equal(screen.views.length, 4);
      for (const view of screen.views) {
        assert.equal(view.state, included ? "changed" : "unchanged");
        if (included) {
          assert.deepEqual(view.excludedResources, undefined);
          assert.deepEqual(view.reasons, [
            {
              kind: "dependency",
              path: "mockups/shared.css",
              analysis: {
                status,
                selectors: [name === "auth rule" ? ".auth" : ".guide"],
              },
            },
          ]);
        } else {
          assert.deepEqual(view.reasons, undefined);
          assert.deepEqual(view.excludedResources, [
            { path: "mockups/shared.css", reason: "no-matching-rule" },
          ]);
        }
      }
      assert.equal(
        screen.sharedImpact.includes("mockups/shared.css"),
        included,
      );
      if (artifact.result.schemaVersion === 3) {
        assert.deepEqual(live.componentChanges?.result, artifact.result);
        assert.equal(
          artifact.result.changes.some((entry) => entry.after?.id === "home"),
          included,
        );
      }
      if (status === "unresolved") {
        const views = artifact.result.screens.flatMap((entry) => entry.views);
        if (artifact.result.schemaVersion === 3)
          views.push(
            ...artifact.result.components.flatMap((entry) =>
              entry.variants.flatMap((variant) => variant.views),
            ),
          );
        assert.ok(
          views.every(
            (view) => view.reasons?.[0]?.analysis?.status === "unresolved",
          ),
        );
      }
      const files = renderReviewArtifact(artifact);
      assert.deepEqual(
        parseReviewResult(JSON.parse(String(files.get("review.json")))),
        artifact.result,
      );
      assert.ok(files.has("snapshots/after/shared.css"));
      assert.match(
        String(files.get("summary.md")),
        artifact.result.schemaVersion === 3
          ? new RegExp(`Changes: ${artifact.result.changes.length};`)
          : new RegExp(
              `output changes: ${artifact.result.screens.filter((screen) => screen.state === "changed").length};`,
            ),
      );
    });
  }

  for (const resource of ["image.svg", "font.woff2"]) {
    test(`CSS attribution v${components ? 3 : 2} preserves ${resource} impact`, async (t) => {
      const fixture = await cssAttributionFixture(t, components);
      await fixture.append("\n", resource);
      const live = await computeCatalogueChanges(
        fixture.config,
        "main",
        committedReviewRepository(fixture.config),
      );
      assert.ok(live.changedRoutes?.includes("screens/home.html"));
      const artifact = await fixture.compare();
      for (const view of artifact.result.screens.find(
        (entry) => entry.id === "home",
      )!.views) {
        assert.deepEqual(view.reasons, [
          { kind: "dependency", path: `mockups/${resource}` },
        ]);
        assert.equal(view.state, "changed");
      }
    });
  }
}
