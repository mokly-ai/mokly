import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { committedReviewRepository } from "../dist/review/repository.js";
import { computeCatalogueChanges } from "../dist/server/changed.js";
import type { ViewResourceEvidence } from "../packages/viewer/dist/review/types.js";

import { cssAttributionFixture } from "./helpers/css_attribution_fixture.js";

for (const scenario of [
  { name: "matched stylesheet", stylesheet: "shared.css", deletedImage: false },
  {
    name: "deleted image without CSS",
    stylesheet: undefined,
    deletedImage: true,
  },
  {
    name: "deleted image with unrelated CSS",
    stylesheet: "unused.css",
    deletedImage: true,
  },
] as const)
  test(`live and complete per-view evidence agree: ${scenario.name}`, async (t) => {
    const image = '<img src="../image.svg" alt="Logo" />';
    const fixture = await cssAttributionFixture(t, false, {
      body: `<button className="auth">Sign in</button>${image}`,
      prepare: async ({ mockupsDir }) => {
        await fs.writeFile(
          path.join(mockupsDir, "shared.css"),
          ".auth { color: black; } .guide { color: black; }",
        );
        await fs.writeFile(
          path.join(mockupsDir, "unused.css"),
          ".unused { color: black; }",
        );
      },
    });
    if (scenario.deletedImage) {
      await fs.writeFile(
        fixture.entryPath,
        (await fs.readFile(fixture.entryPath, "utf8")).replaceAll(image, ""),
      );
      await fs.unlink(path.join(fixture.mockupsDir, "image.svg"));
      await fixture.build();
    }
    if (scenario.stylesheet)
      await fixture.append(".auth { padding: 2px; }", scenario.stylesheet);

    const live = await computeCatalogueChanges(
      fixture.config,
      "main",
      committedReviewRepository(fixture.config),
    );
    const { result } = await fixture.compare();
    assert.equal(result.schemaVersion, 2);
    assert.ok(live.changedRoutes?.includes("screens/home.html"));
    assert.ok(!live.changedRoutes?.includes("screens/details.html"));
    assert.deepEqual(
      result.changedPaths.filter((route) => route.endsWith(".css")),
      scenario.stylesheet ? [`mockups/${scenario.stylesheet}`] : [],
    );
    const screenEvidence = live.componentChanges?.screenEvidence ?? [];
    assert.ok(
      screenEvidence.every((screen) =>
        result.screens.some((compared) => compared.route === screen.route),
      ),
    );
    for (const screen of result.screens) {
      const actual = screenEvidence.find(
        (entry) => entry.route === screen.route,
      );
      assert.equal(screen.views.length, 4);
      assert.equal(
        actual?.views.length ?? 0,
        screen.id === "home" || scenario.stylesheet === "shared.css" ? 4 : 0,
      );
      for (const view of screen.views) {
        const liveView = actual?.views.find(
          (candidate) =>
            candidate.viewport === view.viewport &&
            candidate.colorScheme === view.colorScheme,
        );
        const expected = {
          reasons:
            screen.id === "home"
              ? [
                  scenario.deletedImage
                    ? "mockups/image.svg"
                    : "mockups/shared.css",
                ]
              : [],
          excluded:
            screen.id === "details" && scenario.stylesheet === "shared.css"
              ? ["mockups/shared.css"]
              : [],
        };
        const context = `${screen.route} (${view.viewport}, ${view.colorScheme})`;
        assert.deepEqual(evidencePaths(view), expected, context);
        assert.deepEqual(evidencePaths(liveView), evidencePaths(view), context);
      }
    }
  });

function evidencePaths(view: ViewResourceEvidence | undefined) {
  return {
    reasons: [
      ...new Set(view?.reasons?.map((reason) => reason.path) ?? []),
    ].sort(),
    excluded: [
      ...new Set(
        view?.excludedResources?.map((resource) => resource.path) ?? [],
      ),
    ].sort(),
  };
}
