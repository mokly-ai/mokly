import assert from "node:assert/strict";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { capturePublicFiles } from "../dist/export/public_files.js";
import { assembleExport } from "../dist/export/site.js";
import { committedReviewRepository } from "../dist/review/repository.js";
import { computeCatalogueChanges } from "../dist/server/changed.js";
import {
  childUpdateMessage,
  parseChildUpdateMessage,
} from "../dist/server/update_messages.js";
import { renderWorkspaceEvidence } from "../packages/viewer/dist/client/workspace_evidence.js";
import { mergeWorkspaceEvidence } from "../packages/viewer/dist/client/workspace_updates.js";
import type {
  ScreenReview,
  ViewResourceEvidence,
} from "../packages/viewer/dist/review/types.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import {
  workspaceData,
  type WorkspaceData,
} from "../packages/viewer/dist/shell/workspace_data.js";

import { cssAttributionFixture } from "./helpers/css_attribution_fixture.js";
import { FakeMarkupDocument, fakeMarkup } from "./helpers/fake_markup.js";

for (const [name, edit, resource] of [
  ["matched and excluded rules", ".auth { padding: 2px; }", "shared.css"],
  ["unresolved rules", ".guide { --tone: red; }", "shared.css"],
  ["formatting-only changes", "\n", "shared.css"],
  ["non-CSS resources", "\n", "image.svg"],
] as const) {
  test(`screen-only classification delivers ${name} without component results`, async (t) => {
    const fixture = await cssAttributionFixture(t, false);
    await fixture.append(edit, resource);
    const changes = await computeCatalogueChanges(
      fixture.config,
      "main",
      committedReviewRepository(fixture.config),
    );
    const snapshot = changes.componentChanges;
    assert.ok(snapshot);
    assert.equal(snapshot.result, undefined);
    const artifact = await fixture.compare();
    assert.equal(artifact.result.schemaVersion, 2);
    assert.deepEqual(
      snapshot.screenEvidence,
      artifact.result.screens.map((screen) => ({
        route: screen.route,
        views: resourceViews(screen),
      })),
    );
    const message = childUpdateMessage(
      2,
      changes.changedRoutes,
      snapshot,
      "ready",
      "evidence",
    );
    const wire: unknown = JSON.parse(JSON.stringify(message));
    assert.deepEqual(parseChildUpdateMessage(wire), wire);
    const catalogue = createCatalogue(
      await compileCatalogue(fixture.config).then((value) => value.manifest),
    );
    for (const screen of artifact.result.screens) {
      const entry = catalogue.byId.get(screen.id);
      assert.ok(entry?.kind === "screen");
      const data = workspaceData(
        catalogue,
        {
          base: "main",
          updateVersion: 2,
          comparisons: true,
          changedRoutes: changes.changedRoutes,
          componentChanges: snapshot,
        },
        entry,
      );
      assert.deepEqual(data.resourceEvidence, resourceViews(screen));
      assert.equal(data.change, undefined);
      assert.equal(data.comparison, undefined);
      const node = new FakeMarkupDocument().createElement("section");
      renderWorkspaceEvidence(node as unknown as HTMLElement, data);
      const markup = fakeMarkup(node);
      if (name === "matched and excluded rules") {
        assert.match(
          markup,
          screen.id === "home"
            ? /Changed styles that apply to this screen:/
            : /Examined and excluded:/,
        );
      }
      const pending = { ...data };
      delete pending.resourceEvidence;
      delete pending.status;
      mergeWorkspaceEvidence(data, pending);
      assert.equal(data.resourceEvidence, undefined);
      renderWorkspaceEvidence(node as unknown as HTMLElement, data);
      assert.equal(node.hidden, true);
    }
  });
}

test("static screen-only shells project evidence from the existing v2 comparison", async (t) => {
  const fixture = await cssAttributionFixture(t, false);
  await fixture.append(".auth { padding: 2px; }");
  const changes = await computeCatalogueChanges(
    fixture.config,
    "main",
    committedReviewRepository(fixture.config),
  );
  const comparison = await fixture.compare();
  const site = assembleExport(
    fixture.config,
    await compileCatalogue(fixture.config),
    changes.componentChanges!.baseline,
    comparison,
    await capturePublicFiles(fixture.config),
    [],
  );
  for (const screen of comparison.result.screens) {
    const html = String(site.inventory.files.get(`view/${screen.route}`));
    const json = /<script[^>]*data-workspace-data[^>]*>(.*?)<\/script>/s.exec(
      html,
    )?.[1];
    assert.ok(json);
    const data = JSON.parse(json) as WorkspaceData;
    assert.deepEqual(data.resourceEvidence, resourceViews(screen));
    assert.equal(data.comparison, undefined);
    assert.equal(data.change, undefined);
  }
});

function resourceViews(screen: ScreenReview): readonly ViewResourceEvidence[] {
  return screen.views.map(
    ({ viewport, colorScheme, reasons, excludedResources }) => ({
      viewport,
      colorScheme,
      ...(reasons ? { reasons } : {}),
      ...(excludedResources ? { excludedResources } : {}),
    }),
  );
}
