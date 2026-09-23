import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { readCatalogue } from "../src/catalogue/reader.js";
import type { ViewerEvidenceRevision } from "../src/client/host_capabilities.js";
import type { ViewerCapabilitySource } from "../src/client/host_capability_descriptor.js";
import {
  adoptedViewerCatalogue,
  shellContextWithViewerEvidence,
  shellStateWithViewerEvidence,
} from "../src/shell/capability_adoption.js";
import { routeFromUrl } from "../src/shell/routes.js";
import { createInitialShellState } from "../src/shell/store_initial.js";
import { viewerCatalogue, viewerContext } from "../src/viewer/projection.js";
import { defaultSelection } from "../src/viewer/selection.js";

const model = readCatalogue(
  JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../docs/protocol/fixtures/catalogue-v1.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ),
);

test("new evidence adopts before making a replaced historical snapshot unavailable", () => {
  const historical = model.removedEntries[0]!;
  assert.ok(historical.snapshotId);
  if (historical.entry.kind !== "page") assert.fail("Expected removed page");
  const selection = {
    ...defaultSelection,
    screenId: historical.entry.id,
    snapshotId: historical.snapshotId,
  };
  const current = viewerCatalogue(model);
  const route = routeFromUrl(
    current,
    new URL(
      `https://catalogue.test/view/${historical.entry.route}?snapshot=${historical.snapshotId}`,
    ),
  );
  assert.equal(route.view.kind, "target");
  const source: ViewerCapabilitySource = {
    base: "origin/main",
    catalogueId: model.identity.id,
    contentRevision: model.revision.content,
    evidenceRevision: model.revision.evidence,
    updateVersion: 1,
  };
  const context = {
    ...viewerContext(model, selection),
    base: source.base,
    contentVersion: source.contentRevision,
    updateVersion: source.updateVersion,
  };
  const state = createInitialShellState(
    current,
    context,
    route.view,
    undefined,
  );
  const nextModel = {
    ...model,
    revision: { ...model.revision, evidence: model.revision.evidence + 1 },
    removedEntries: model.removedEntries.map((record, index) =>
      index === 0 ? { ...record, snapshotId: "f".repeat(64) } : record,
    ),
  };
  const revision: ViewerEvidenceRevision = {
    catalogue: nextModel,
    source: {
      ...source,
      evidenceRevision: nextModel.revision.evidence,
      updateVersion: 2,
    },
  };

  const adopted = adoptedViewerCatalogue(current, source, route, revision);
  assert.ok(adopted);
  const nextState = shellStateWithViewerEvidence(state, adopted);
  assert.ok(nextState);
  assert.equal(nextState.route.view.kind, "missing");
  assert.equal(nextState.selection.snapshotId, historical.snapshotId);

  const projected = shellContextWithViewerEvidence(
    context,
    adopted,
    revision.source,
    nextState,
  );
  assert.equal(projected.snapshotId, undefined);
  assert.equal(projected.activeRoute, undefined);
  assert.equal(projected.updateVersion, 2);

  const reusedRoute = viewerCatalogue({
    ...nextModel,
    pages: [...nextModel.pages, historical.entry],
    removedEntries: nextModel.removedEntries.slice(1),
  });
  const noDowngrade = shellStateWithViewerEvidence(state, reusedRoute);
  assert.ok(noDowngrade);
  assert.equal(noDowngrade.route.view.kind, "missing");
});
