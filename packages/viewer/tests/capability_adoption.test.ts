import assert from "node:assert/strict";
import test from "node:test";

import { projectScopedCatalogue } from "../src/catalogue/scoped_projection.js";
import { viewerCapabilityRequest } from "../src/client/host_capability_descriptor.js";
import { viewHref } from "../src/navigation/routes.js";
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
    new URL("https://example.test/view/product/browse/home/"),
  );
  const source = capabilitySource(model, 4);
  const nextModel = evidenceRevision(model, ["product/browse/home"]);
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
      disclosures: {},
      colorScheme: "light",
      detailsOpen: true,
      drawerOpen: true,
      filterBaselineDisclosures: null,
      navScroll: 73,
      query: "product/browse/home",
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
  assert.equal(adopted.query, "product/browse/home");
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
  assert.deepEqual(projected.changedEntries, [
    "product/browse/home",
    "product",
  ]);
});

test("live evidence preserves host shell mode and comparison availability", () => {
  assert.equal(model.comparisonUrl, null);
  const catalogue = viewerCatalogue(model);
  const route = routeFromUrl(
    catalogue,
    new URL("https://example.test/view/product/browse/home/"),
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
    new URL("https://example.test/view/product/browse/home/"),
  );
  const source = capabilitySource(model, 4);
  const nextModel = evidenceRevision(model, ["product/browse/home"]);
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
    commit.snapshot.workspace?.value.entry.path,
    "product/browse/home",
  );
});

test("route adoption replaces scoped usage and private workspace atomically", () => {
  const component = model.components.find((entry) => !("variantOf" in entry));
  const screen = model.screens[0];
  assert.ok(component?.kind === "component");
  assert.ok(screen);
  const componentScope = projectScopedCatalogue(model, {
    kind: "target",
    entryPath: component.path,
    entryKind: component.kind,
  });
  const screenScope = projectScopedCatalogue(model, {
    kind: "target",
    entryPath: screen.path,
    entryKind: screen.kind,
  });
  const current = viewerCatalogue(componentScope);
  const complete = viewerCatalogue(model);
  const componentEntry = complete.byPath.get(component.path);
  const screenEntry = complete.byPath.get(screen.path);
  assert.ok(componentEntry?.kind === "component");
  assert.ok(screenEntry?.kind === "screen");
  const route = routeFromUrl(
    current,
    new URL(`https://example.test${viewHref(screen.path)}`),
  );
  const source = capabilitySource(model, 4);
  const state = createInitialShellState(
    current,
    viewerContext(componentScope, {
      ...defaultSelection,
      screenPath: screen.path,
    }),
    route.view,
    undefined,
  );
  const componentRequest = viewerCapabilityRequest(source, component.path);
  const commit = commitViewerEvidence(
    {
      catalogue: current,
      routeEvidence: componentRequest,
      source,
      workspace: {
        request: componentRequest,
        value: publicWorkspace(model, componentEntry),
      },
    },
    state,
    {
      catalogue: screenScope,
      source,
      workspace: publicWorkspace(model, screenEntry),
    },
  );
  assert.ok(commit);
  assert.equal(commit.snapshot.workspace?.value.entry.path, screen.path);
  assert.equal(commit.snapshot.routeEvidence?.entryPath, screen.path);
  const adopted = commit.snapshot.catalogue.publicModel!;
  assert.ok(
    adopted.screens[0]!.views.every(({ usage }) => usage.status !== "omitted"),
  );
  assert.ok(
    adopted.components
      .filter((entry) => "variantOf" in entry)
      .every((variant) =>
        variant.views.every(({ usage }) => usage.status === "omitted"),
      ),
  );
});
