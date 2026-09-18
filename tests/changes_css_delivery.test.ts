import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { exportCatalogue } from "../dist/export/run.js";
import { readManifest } from "../dist/registry/manifest.js";
import { committedReviewRepository } from "../dist/review/repository.js";
import {
  ComponentChangeCache,
  RepositoryComponentChanges,
} from "../dist/server/component_changes.js";
import { startCatalogueServer } from "../dist/server/http.js";
import { configuredServedReview } from "../dist/server/review_routes.js";
import { parseReviewResult } from "../packages/viewer/dist/review/result_validation.js";

import { cssAttributionFixture } from "./helpers/css_attribution_fixture.js";

for (const components of [false, true])
  test(`v${components ? 3 : 2} CSS evidence survives selected HTTP, watched cache, and static export`, async (t) => {
    const fixture = await cssAttributionFixture(t, components);
    const manifest = readManifest(fixture.config);
    const cache = new ComponentChangeCache(
      new RepositoryComponentChanges(fixture.config, manifest, "main"),
    );
    await fixture.append(".guide { padding: 2px; }");
    const snapshot = await cache.read(1);
    assert.ok(snapshot);
    assert.ok(!snapshot.changedRoutes?.includes("screens/home.html"));
    const artifact = await fixture.compare();
    const expected = artifact.result.screens.find(
      (entry) => entry.id === "home",
    )!;
    const server = await startCatalogueServer(fixture.config, {
      base: "main",
      port: 0,
      manifest,
      componentChanges: snapshot,
      review: configuredServedReview(
        fixture.config,
        "main",
        committedReviewRepository(fixture.config),
      ),
    });
    t.after(() => server.close());
    const response = await fetch(
      `${server.url}/__mokly/diffs/review.json?route=screens%2Fhome.html`,
    );
    assert.equal(response.status, 200, await response.clone().text());
    const selected = parseReviewResult(await response.json());
    assert.deepEqual(selected.screens, [expected]);
    for (const view of selected.screens[0]!.views) {
      assert.equal(view.state, "unchanged");
      assert.equal(
        (await fetch(new URL(view.afterPath!, response.url))).status,
        200,
      );
    }
    const exported = await exportCatalogue(fixture.config, {
      outDir: "site",
      base: "main",
    });
    assert.ok(exported.comparisonUrl);
    const saved = parseReviewResult(
      JSON.parse(
        await fs.readFile(
          path.join(exported.outDir, exported.comparisonUrl),
          "utf8",
        ),
      ),
    );
    assert.deepEqual(saved.screens, artifact.result.screens);
    const html = await fs.readFile(
      path.join(exported.outDir, "index.html"),
      "utf8",
    );
    assert.doesNotMatch(html, /data-changed="true"[^>]*data-entry-id="home"/);
    await fixture.append(".auth { padding: 3px; }");
    cache.invalidate();
    const updated = await cache.read(2);
    assert.ok(updated);
    assert.ok(updated?.changedRoutes?.includes("screens/home.html"));
    const complete = await fixture.compare();
    if (complete.result.schemaVersion === 3)
      assert.deepEqual(updated.result, complete.result);
  });

for (const components of [false, true])
  test(`v${components ? 3 : 2} aggregates only the views that kept a stylesheet`, async (t) => {
    const fixture = await cssAttributionFixture(t, components);
    await fixture.append(
      '[data-mokly-viewport="desktop"] .auth { padding: 3px; }',
    );
    const { result } = await fixture.compare();
    const home = result.screens.find((entry) => entry.id === "home")!;
    for (const view of home.views) {
      assert.equal(
        view.state,
        view.viewport === "desktop" ? "changed" : "unchanged",
      );
      assert.equal(Boolean(view.excludedResources), view.viewport === "mobile");
    }
    assert.deepEqual(home.sharedImpact, ["mockups/shared.css"]);
    if (result.schemaVersion === 3)
      assert.deepEqual(
        result.changes.find((entry) => entry.after?.id === "home")?.reasons,
        home.views.find((view) => view.viewport === "desktop")?.reasons,
      );
  });

for (const components of [false, true])
  test(`v${components ? 3 : 2} a broad glob adds no unreferenced CSS resource`, async (t) => {
    const fixture = await cssAttributionFixture(t, components);
    await fixture.append("body { --tone: red; }", "unused.css");
    const { result } = await fixture.compare();
    assert.ok(
      result.screens.every((entry) =>
        entry.views.every((view) => !view.reasons && !view.excludedResources),
      ),
    );
    if (result.schemaVersion === 3) assert.deepEqual(result.changes, []);
  });
