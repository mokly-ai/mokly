import assert from "node:assert/strict";
import test from "node:test";

import { projectScopedCatalogue } from "../src/catalogue/scoped_projection.js";
import { viewerCapabilityRequest } from "../src/client/host_capability_descriptor.js";
import {
  adoptedViewerCatalogue,
  shellContextWithViewerEvidence,
  shellStateWithViewerEvidence,
} from "../src/shell/capability_adoption.js";
import { commitViewerEvidence } from "../src/shell/capability_commit.js";
import { routeFromUrl } from "../src/shell/routes.js";
import { createInitialShellState } from "../src/shell/store_initial.js";
import { viewerCatalogue, viewerContext } from "../src/viewer/projection.js";
import { publicWorkspace } from "../src/viewer/public_workspace.js";
import { defaultSelection } from "../src/viewer/selection.js";

import {
  capabilitySource,
  evidenceRevision,
  model,
  viewerRevision,
} from "./capability_adoption_fixture.js";

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
