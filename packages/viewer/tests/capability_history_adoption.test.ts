import assert from "node:assert/strict";
import test from "node:test";

import type { CatalogueReadModel } from "../src/catalogue/types.js";
import {
  adoptedViewerCatalogue,
  shellStateWithViewerEvidence,
} from "../src/shell/capability_adoption.js";
import { routeFromUrl } from "../src/shell/routes.js";
import { createInitialShellState } from "../src/shell/store_initial.js";
import { viewerCatalogue, viewerContext } from "../src/viewer/projection.js";
import { defaultSelection } from "../src/viewer/selection.js";

import {
  capabilitySource,
  evidenceRevision,
  model,
  viewerRevision,
} from "./capability_adoption_fixture.js";

test("live evidence retains unchanged identity-less historical metadata", () => {
  const screen = model.screens[0]!;
  const historical: CatalogueReadModel = {
    ...model,
    screens: model.screens.slice(1),
    removedEntries: [{ entry: screen, ancestors: [] }],
  };
  const current = viewerCatalogue(historical);
  const route = routeFromUrl(
    current,
    new URL(`https://example.test/view/${screen.route}`),
  );
  const source = capabilitySource(historical, 4);
  const unchanged: CatalogueReadModel = {
    ...historical,
    revision: {
      ...historical.revision,
      evidence: historical.revision.evidence + 1,
    },
  };
  const revision = viewerRevision(unchanged, source, route);
  const next = adoptedViewerCatalogue(current, source, route, revision);
  assert.ok(next);
  const context = viewerContext(historical, {
    ...defaultSelection,
    screenId: screen.id,
  });
  const state = createInitialShellState(
    current,
    context,
    route.view,
    undefined,
  );
  const adopted = shellStateWithViewerEvidence(state, next);
  assert.ok(adopted);
  assert.equal(adopted.route.view.kind, "target");
  assert.equal(
    adopted.route.view.kind === "target"
      ? adopted.route.view.target.entry.title
      : undefined,
    screen.title,
  );
});

test("live evidence rejects changed or removed identity-less history", () => {
  const screen = model.screens[0]!;
  const historical: CatalogueReadModel = {
    ...model,
    screens: model.screens.slice(1),
    removedEntries: [{ entry: screen, ancestors: [] }],
  };
  const current = viewerCatalogue(historical);
  const route = routeFromUrl(
    current,
    new URL(`https://example.test/view/${screen.route}`),
  );
  const source = capabilitySource(historical, 4);
  const changed: CatalogueReadModel = {
    ...historical,
    revision: {
      ...historical.revision,
      evidence: historical.revision.evidence + 1,
    },
    removedEntries: [
      { entry: { ...screen, title: "Earlier home" }, ancestors: [] },
    ],
  };
  const removed: CatalogueReadModel = {
    ...changed,
    removedEntries: [],
  };

  for (const candidate of [changed, removed])
    assert.equal(
      adoptedViewerCatalogue(
        current,
        source,
        route,
        viewerRevision(candidate, source, route),
      ),
      undefined,
    );
});

test("live evidence rejects private workspace removal drift", () => {
  const current = viewerCatalogue(model);
  const route = routeFromUrl(
    current,
    new URL("https://example.test/view/screens/home.html"),
  );
  const source = capabilitySource(model, 4);
  const nextModel = evidenceRevision(model, []);
  const revision = viewerRevision(nextModel, source, route);
  assert.ok(revision.workspace);
  revision.workspace = { ...revision.workspace, removed: true };

  assert.equal(
    adoptedViewerCatalogue(current, source, route, revision),
    undefined,
  );
});
