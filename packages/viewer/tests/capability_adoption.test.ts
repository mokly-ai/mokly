import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { readCatalogue } from "../src/catalogue/reader.js";
import { projectScopedCatalogue } from "../src/catalogue/scoped_projection.js";
import type { CatalogueReadModel } from "../src/catalogue/types.js";
import type { ViewerEvidenceRevision } from "../src/client/host_capabilities.js";
import type { ViewerCapabilitySource } from "../src/client/host_capability_descriptor.js";
import { viewerCapabilityRequest } from "../src/client/host_capability_descriptor.js";
import {
  adoptedViewerCatalogue,
  shellContextWithViewerEvidence,
  shellStateWithViewerEvidence,
} from "../src/shell/capability_adoption.js";
import { commitViewerEvidence } from "../src/shell/capability_commit.js";
import { catalogueRouteEntry } from "../src/shell/catalogue.js";
import { routeFromUrl } from "../src/shell/routes.js";
import { createInitialShellState } from "../src/shell/store_initial.js";
import { viewerCatalogue, viewerContext } from "../src/viewer/projection.js";
import { publicWorkspace } from "../src/viewer/public_workspace.js";
import { defaultSelection } from "../src/viewer/selection.js";

const fixtureModel = readCatalogue(
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
const model: CatalogueReadModel = {
  ...fixtureModel,
  comparisonUrl: null,
  removedEntries: [],
};

test("live evidence rebinds records while preserving interaction state", () => {
  const current = viewerCatalogue(model);
  const route = routeFromUrl(
    current,
    new URL("https://example.test/view/screens/home.html"),
  );
  const source = capabilitySource(model, 4);
  const nextModel = evidenceRevision(model, ["screens/home.html"]);
  const revision = viewerRevision(nextModel, source, route);
  const next = adoptedViewerCatalogue(current, source, route, revision);
  assert.ok(next);

  const context = {
    ...viewerContext(model, defaultSelection),
    base: source.base,
    contentVersion: source.contentRevision,
    updateVersion: source.updateVersion,
  };
  const initial = createInitialShellState(current, context, route.view, {
    recovery: {
      closedCollectionIds: [],
      colorScheme: "light",
      detailsOpen: true,
      drawerOpen: true,
      filterBaselineClosedCollectionIds: null,
      navScroll: 73,
      query: "home",
      regionScrolls: { stage: 29 },
      view: "all",
      viewport: "mobile",
    },
  });
  const adopted = shellStateWithViewerEvidence(initial, next);
  assert.ok(adopted);
  assert.equal(adopted.detailsOpen, true);
  assert.equal(adopted.drawerOpen, true);
  assert.equal(adopted.navScroll, 73);
  assert.equal(adopted.query, "home");
  assert.deepEqual(adopted.regionScrolls, { stage: 29 });
  assert.equal(adopted.selection.viewport, "mobile");
  assert.equal(adopted.route.view.kind, "target");
  assert.notEqual(adopted.route, initial.route);

  const projected = shellContextWithViewerEvidence(
    context,
    next,
    revision.source,
    adopted,
  );
  assert.equal(projected.updateVersion, 5);
  assert.deepEqual(projected.changedRoutes, ["screens/home.html"]);
});

test("live evidence preserves host shell mode and comparison availability", () => {
  assert.equal(model.comparisonUrl, null);
  const catalogue = viewerCatalogue(model);
  const route = routeFromUrl(
    catalogue,
    new URL("https://example.test/view/screens/home.html"),
  );
  const source = capabilitySource(model, 4);
  const context = {
    ...viewerContext(model, defaultSelection),
    comparisons: true,
    embedded: false,
  };
  const state = createInitialShellState(
    catalogue,
    context,
    route.view,
    undefined,
  );

  const projected = shellContextWithViewerEvidence(
    context,
    catalogue,
    source,
    state,
  );

  assert.equal(projected.comparisons, true);
  assert.equal(projected.embedded, false);
});

test("newer evidence adopts when the server update version is unchanged", () => {
  const current = viewerCatalogue(model);
  const route = routeFromUrl(
    current,
    new URL("https://example.test/view/screens/home.html"),
  );
  const source = capabilitySource(model, 4);
  const nextModel = evidenceRevision(model, ["screens/home.html"]);
  const revision = viewerRevision(nextModel, source, route);
  revision.source = { ...revision.source, updateVersion: source.updateVersion };
  const context = {
    ...viewerContext(model, defaultSelection),
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

  assert.ok(adoptedViewerCatalogue(current, source, route, revision));
  const commit = commitViewerEvidence(
    { catalogue: current, source },
    state,
    revision,
  );
  assert.ok(commit);
  assert.equal(
    commit.snapshot.catalogue.publicModel?.revision.evidence,
    nextModel.revision.evidence,
  );
  assert.deepEqual(commit.snapshot.source, revision.source);
  assert.deepEqual(commit.snapshot.workspace?.request.source, revision.source);
  assert.equal(
    commit.snapshot.workspace?.value.entry.route,
    "screens/home.html",
  );
});

test("route adoption replaces scoped usage and private workspace atomically", () => {
  const componentRoute = model.components[0]!.route;
  const screenRoute = model.screens[0]!.route;
  const componentScope = projectScopedCatalogue(model, {
    kind: "target",
    route: componentRoute,
  });
  const screenScope = projectScopedCatalogue(model, {
    kind: "target",
    route: screenRoute,
  });
  const current = viewerCatalogue(componentScope);
  const complete = viewerCatalogue(model);
  const component = complete.byRoute.get(componentRoute);
  const screen = complete.byRoute.get(screenRoute);
  assert.ok(component?.kind === "component");
  assert.ok(screen?.kind === "screen");
  const route = routeFromUrl(
    current,
    new URL(`https://example.test/view/${screenRoute}`),
  );
  const source = capabilitySource(model, 4);
  const state = createInitialShellState(
    current,
    viewerContext(componentScope, {
      ...defaultSelection,
      screenId: screen.id,
    }),
    route.view,
    undefined,
  );
  const componentRequest = viewerCapabilityRequest(source, componentRoute);
  const commit = commitViewerEvidence(
    {
      catalogue: current,
      routeEvidence: componentRequest,
      source,
      workspace: {
        request: componentRequest,
        value: publicWorkspace(model, component),
      },
    },
    state,
    {
      catalogue: screenScope,
      source,
      workspace: publicWorkspace(model, screen),
    },
  );
  assert.ok(commit);
  assert.equal(commit.snapshot.workspace?.value.entry.route, screenRoute);
  assert.equal(commit.snapshot.routeEvidence?.route, screenRoute);
  const adopted = commit.snapshot.catalogue.publicModel!;
  assert.ok(
    adopted.screens[0]!.views.every(({ usage }) => usage.status !== "omitted"),
  );
  assert.ok(
    adopted.components[0]!.variants.every((variant) =>
      variant.views.every(({ usage }) => usage.status === "omitted"),
    ),
  );
});

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

function evidenceRevision(
  value: CatalogueReadModel,
  changedRoutes: readonly string[],
): CatalogueReadModel {
  const changed = new Set(changedRoutes);
  return {
    ...value,
    revision: { ...value.revision, evidence: value.revision.evidence + 1 },
    screens: value.screens.map((entry) => ({
      ...entry,
      changes: {
        status: "ready" as const,
        kind: changed.has(entry.route) ? "changed" : "unmodified",
        included: changed.has(entry.route),
      },
    })),
  };
}

function capabilitySource(
  value: CatalogueReadModel,
  updateVersion: number,
): ViewerCapabilitySource {
  return {
    base: "origin/main",
    catalogueId: value.identity.id,
    contentRevision: value.revision.content,
    evidenceRevision: value.revision.evidence,
    updateVersion,
  };
}

function viewerRevision(
  value: CatalogueReadModel,
  current: ViewerCapabilitySource,
  route: ReturnType<typeof routeFromUrl>,
): ViewerEvidenceRevision {
  const next = viewerCatalogue(value);
  const routeValue =
    route.view.kind === "target" ? route.view.target.entry.route : undefined;
  const entry = routeValue ? catalogueRouteEntry(next, routeValue) : undefined;
  const workspace =
    entry && (entry.kind === "screen" || entry.kind === "component")
      ? {
          ...publicWorkspace(value, entry),
          base: current.base,
        }
      : undefined;
  return {
    catalogue: value,
    source: {
      ...current,
      evidenceRevision: value.revision.evidence,
      updateVersion: current.updateVersion + 1,
    },
    ...(workspace ? { workspace } : {}),
  };
}
