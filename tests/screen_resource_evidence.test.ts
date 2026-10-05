import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { compileCatalogue } from "../dist/build/compile.js";
import { capturePublicFiles } from "../dist/export/public_files.js";
import { assembleExport } from "../dist/export/site.js";
import { computeCatalogueChanges } from "../dist/server/changed.js";
import {
  childUpdateMessage,
  parseChildUpdateMessage,
} from "../dist/server/update_messages.js";
import type {
  ScreenReview,
  ViewResourceEvidence,
} from "../packages/viewer/dist/review/types.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import {
  workspaceData,
  type WorkspaceData,
} from "../packages/viewer/dist/shell/workspace_data.js";
import { WorkspaceEvidence } from "../packages/viewer/dist/shell/workspace_evidence.js";
import { mergeWorkspaceEvidence } from "../packages/viewer/dist/shell/workspace_evidence_merge.js";

import { committedReviewRepository } from "./helpers/committed_repository.js";
import { cssAttributionFixture } from "./helpers/css_attribution_fixture.js";

for (const [name, edit, resource] of [
  ["matched and excluded rules", ".auth { padding: 2px; }", "shared.css"],
  ["unresolved rules", ".guide { --tone: red; }", "shared.css"],
  ["formatting-only changes", "\n", "shared.css"],
  ["non-CSS resources", "\n", "image.svg"],
] as const) {
  test(`screen-only classification delivers ${name} in unified v5 results`, async (t) => {
    const fixture = await cssAttributionFixture(t, false);
    await fixture.append(edit, resource);
    const changes = await computeCatalogueChanges(
      fixture.config,
      "main",
      committedReviewRepository(fixture.config),
    );
    const snapshot = changes.componentChanges;
    assert.ok(snapshot);
    const artifact = await fixture.compare();
    assert.equal(artifact.result.schemaVersion, 6);
    assert.deepEqual(snapshot.result, artifact.result);
    assert.deepEqual(
      snapshot.screenEvidence,
      artifact.result.screens.map((screen) => ({
        path: screen.path,
        views: resourceViews(screen),
      })),
    );
    const message = childUpdateMessage(
      2,
      changes.changedEntries,
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
      const entry = catalogue.byPath.get(screen.path);
      assert.ok(entry?.kind === "screen");
      const data = workspaceData(
        catalogue,
        {
          base: "main",
          updateVersion: 2,
          comparisons: true,
          changedEntries: changes.changedEntries,
          componentChanges: snapshot,
        },
        entry,
      );
      assert.deepEqual(data.resourceEvidence, resourceViews(screen));
      assert.deepEqual(data.comparison, screen);
      assert.deepEqual(
        data.change,
        artifact.result.changes.find(
          (change) => (change.after ?? change.before)?.path === screen.path,
        ),
      );
      const markup = renderEvidence(data);
      if (name === "matched and excluded rules") {
        assert.match(
          markup,
          screen.path === "home"
            ? /Changed styles that apply to this screen:/
            : /Examined and excluded:/,
        );
      }
      const pending = { ...data };
      delete pending.resourceEvidence;
      delete pending.status;
      delete pending.change;
      delete pending.comparison;
      mergeWorkspaceEvidence(data, pending);
      assert.equal(data.resourceEvidence, undefined);
      assert.match(renderEvidence(data), / hidden=""/);
    }
  });
}

function renderEvidence(data: WorkspaceData): string {
  return renderToStaticMarkup(createElement(WorkspaceEvidence, { data }));
}

test("static screen-only shells project evidence from the unified v5 comparison", async (t) => {
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
    await compileCatalogue(fixture.config).then((compilation) =>
      capturePublicFiles(
        fixture.config,
        compilation.outputs,
        compilation.manifest.assetClosure,
      ),
    ),
    [],
  );
  for (const screen of comparison.result.screens) {
    const html = String(
      site.inventory.files.get(`view/${screen.path}/index.html`),
    );
    const json = /<script[^>]*data-workspace-data[^>]*>(.*?)<\/script>/s.exec(
      html,
    )?.[1];
    assert.ok(json);
    const data = JSON.parse(json) as WorkspaceData;
    assert.deepEqual(data.resourceEvidence, resourceViews(screen));
    assert.deepEqual(data.comparison, screen);
    assert.deepEqual(
      data.change,
      comparison.result.changes.find(
        (change) => (change.after ?? change.before)?.path === screen.path,
      ),
    );
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
