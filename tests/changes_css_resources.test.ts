import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { computeCatalogueChanges } from "../dist/server/changed.js";

import { committedReviewRepository } from "./helpers/committed_repository.js";
import { cssAttributionFixture } from "./helpers/css_attribution_fixture.js";

for (const components of [false, true]) {
  test(`v${components ? 3 : 2} paired ignored content in embedded documents cannot keep CSS`, async (t) => {
    const fixture = await cssAttributionFixture(t, components, {
      body: '<iframe src="../../embedded.html" title="Guide" />',
      prepare: ({ mockupsDir }) =>
        fs.writeFile(
          path.join(mockupsDir, "embedded.html"),
          '<!doctype html><link rel="stylesheet" href="shared.css"><!--mokly-review-ignore:start:chrome--><p class="ignored-frame">Chrome</p><!--mokly-review-ignore:end:chrome-->',
        ),
    });
    await fixture.append(".ignored-frame { padding: 2px; }");
    const live = await computeCatalogueChanges(
      fixture.config,
      "main",
      committedReviewRepository(fixture.config),
    );
    assert.ok(!live.changedRoutes?.includes("screens/home.html"));
    const { result } = await fixture.compare();
    for (const view of result.screens.find((screen) => screen.id === "home")!
      .views)
      assert.equal(view.state, "unchanged");
  });
  test(`v${components ? 3 : 2} matches styles inside embedded documents`, async (t) => {
    const fixture = await cssAttributionFixture(t, components, {
      body: '<iframe src="../../embedded.html" title="Guide" />',
      prepare: ({ mockupsDir }) =>
        fs.writeFile(
          path.join(mockupsDir, "embedded.html"),
          '<!doctype html><link rel="stylesheet" href="shared.css"><p class="inside-frame">Embedded guide</p>',
        ),
    });
    await fixture.append(".inside-frame { padding: 2px; }");
    const live = await computeCatalogueChanges(
      fixture.config,
      "main",
      committedReviewRepository(fixture.config),
    );
    assert.ok(live.changedRoutes?.includes("screens/home.html"));
    const { result } = await fixture.compare();
    for (const view of result.screens.find((screen) => screen.id === "home")!
      .views) {
      assert.equal(view.state, "changed");
      assert.deepEqual(view.reasons?.[0]?.analysis, {
        status: "matched",
        selectors: [".inside-frame"],
      });
    }
    if (result.schemaVersion === 3)
      assert.deepEqual(live.componentChanges?.result, result);
  });

  test(`v${components ? 3 : 2} analyses transitive CSS with batched counterpart reads`, async (t) => {
    const fixture = await cssAttributionFixture(t, components, {
      prepare: async ({ mockupsDir }) => {
        await fs.appendFile(
          path.join(mockupsDir, "shared.css"),
          '@import "nested.css";',
        );
        await fs.writeFile(
          path.join(mockupsDir, "nested.css"),
          ".guide { padding: 1px; }",
        );
      },
    });
    await fixture.append(".guide { padding: 2px; }", "nested.css");
    const live = await computeCatalogueChanges(
      fixture.config,
      "main",
      committedReviewRepository(fixture.config),
    );
    assert.ok(!live.changedRoutes?.includes("screens/home.html"));
    const { result } = await fixture.compare();
    for (const view of result.screens.find((screen) => screen.id === "home")!
      .views)
      assert.deepEqual(view.excludedResources, [
        { path: "mockups/nested.css", reason: "no-matching-rule" },
      ]);
    if (result.schemaVersion === 3)
      assert.deepEqual(live.componentChanges?.result, result);
  });

  test(`v${components ? 3 : 2} validates resources even when CSS rules are excluded`, async (t) => {
    const fixture = await cssAttributionFixture(t, components);
    await fixture.append(".guide { padding: 2px; }");
    await fs.rm(path.join(fixture.mockupsDir, "image.svg"));
    await fs.symlink(
      "../../notes.md",
      path.join(fixture.mockupsDir, "image.svg"),
    );
    await assert.rejects(
      computeCatalogueChanges(
        fixture.config,
        "main",
        committedReviewRepository(fixture.config),
      ),
    );
    await assert.rejects(fixture.compare());
  });
}
