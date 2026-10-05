import assert from "node:assert/strict";
import { test } from "node:test";

import { viewHref } from "../src/navigation/routes.js";
import { catalogueNavSections } from "../src/shell/nav_model.js";
import { routeFromUrl } from "../src/shell/routes.js";
import { withRoute } from "../src/shell/store_filters.js";
import {
  announceNavigation,
  frameMissState,
  hostRoute,
  hostSelectionRouteChanged,
} from "../src/shell/store_host_routes.js";
import { createInitialShellState } from "../src/shell/store_initial.js";
import { viewerCatalogue, viewerContext } from "../src/viewer/projection.js";
import { defaultSelection } from "../src/viewer/selection.js";
import type { ScreenNavigateEvent } from "../src/viewer/types.js";

import { catalogue, context, model } from "./shell_state_fixture.js";

test("live host routing carries exact history and announces its entry", () => {
  const historical = model.removedEntries[0]!;
  assert.ok(historical.snapshotId);
  const selection = {
    ...defaultSelection,
    screenPath: historical.entry.path,
    snapshotId: historical.snapshotId,
  };
  const route = hostRoute(catalogue, selection, "hero");
  assert.equal(route.snapshot, historical.snapshotId);
  assert.equal(route.fragment, "hero");
  const navigations: unknown[] = [];
  announceNavigation(
    {
      model,
      events: () => ({
        onScreenNavigate: (event: ScreenNavigateEvent) =>
          navigations.push(event),
      }),
    } as never,
    selection,
    route.fragment,
    undefined,
  );
  assert.deepEqual(navigations, [
    {
      screenPath: historical.entry.path,
      snapshotId: historical.snapshotId,
      fragment: "hero",
    },
  ]);
});

test("bare removed routes announce only published snapshot identity", () => {
  const identityless = structuredClone(model);
  delete identityless.removedEntries[0]!.snapshotId;

  const announceBareRoute = (candidate: typeof model) => {
    const historical = candidate.removedEntries[0]!;
    const candidateCatalogue = viewerCatalogue(candidate);
    const route = routeFromUrl(
      candidateCatalogue,
      new URL(viewHref(historical.entry.path), "https://example.test"),
    );
    const initial = createInitialShellState(
      candidateCatalogue,
      viewerContext(candidate, defaultSelection),
      { kind: "home" },
      undefined,
    );
    const state = withRoute(
      initial,
      route,
      candidateCatalogue,
      catalogueNavSections(candidateCatalogue),
    );
    const navigations: ScreenNavigateEvent[] = [];
    announceNavigation(
      {
        model: candidate,
        events: () => ({
          onScreenNavigate: (event: ScreenNavigateEvent) =>
            navigations.push(event),
        }),
      } as never,
      state.selection,
      state.route.fragment,
      undefined,
    );
    return navigations;
  };

  const historical = model.removedEntries[0]!;
  assert.ok(historical.snapshotId);
  assert.deepEqual(announceBareRoute(identityless), [
    { screenPath: historical.entry.path },
  ]);
  assert.deepEqual(announceBareRoute(model), [
    {
      screenPath: historical.entry.path,
      snapshotId: historical.snapshotId,
    },
  ]);
});

test("unknown frame routes mutate only uncontrolled host display state", () => {
  const sections = catalogueNavSections(catalogue);
  const home = routeFromUrl(
    catalogue,
    new URL("https://example.test/view/product/browse/home/"),
  );
  const missing = routeFromUrl(
    catalogue,
    new URL("https://example.test/view/missing-entry"),
  );
  const state = createInitialShellState(
    catalogue,
    context,
    home.view,
    undefined,
  );

  assert.equal(frameMissState(state, missing, sections, true), state);
  const uncontrolled = frameMissState(state, missing, sections, false);
  assert.equal(uncontrolled.route.view.kind, "missing");
  assert.equal(
    hostSelectionRouteChanged(catalogue, uncontrolled, state.selection),
    true,
  );
  assert.equal(
    hostSelectionRouteChanged(catalogue, state, state.selection),
    false,
  );
});
