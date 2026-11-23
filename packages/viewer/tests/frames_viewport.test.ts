/**
 * The Frames filter's toggles in the shell store, under the canvas stage
 * contract: a viewport toggle sets the selection's `viewport` as one
 * selection change, and a scheme toggle stays with the shell.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { ViewerSelection } from "../src/host/types.js";
import { catalogueNavSections } from "../src/shell/nav_model.js";
import { shellContext } from "../src/shell/projection.js";
import { shellStore } from "../src/shell/store_actions.js";

import {
  baseModel,
  initialState,
  shellCatalogue,
} from "./disclosure_evidence_fixture.js";

/**
 * A store on Home from `route`: an embedded one proposes each selection
 * change and commits nothing, as for a controlled host, and a standalone one
 * commits it.
 */
function harness(embedded: boolean, route = "/view/product/browse/home") {
  const model = baseModel();
  const catalogue = shellCatalogue(model);
  let state = initialState(model, route);
  const stateRef = { current: state };
  const proposals: Partial<ViewerSelection>[] = [];
  const store = shellStore({
    catalogue,
    context: shellContext(catalogue.publicModel, state.selection),
    embedded,
    interactive: true,
    navigation: {
      navigateFrame() {},
      onShellClick() {},
      onShellKeyDown() {},
      openFrame() {},
    },
    propose(selection) {
      proposals.push(selection);
    },
    sections: catalogueNavSections(catalogue),
    setState(action) {
      state = typeof action === "function" ? action(state) : action;
      stateRef.current = state;
    },
    state,
    stateRef,
  });
  return { proposals, state: () => state, store };
}

test("a viewport toggle proposes the viewport of the toggles that stay on", () => {
  const { proposals, state, store } = harness(true);
  store.toggleFrame("mobile", false);
  store.toggleFrame("desktop", false);
  assert.deepEqual(proposals, [
    { viewport: "desktop" },
    { viewport: "mobile" },
  ]);
  // The host commits nothing until it supplies the proposal back.
  assert.equal(state().selection.viewport, "both");
  // An axis keeps one toggle on, so the last one shown proposes nothing.
  const desktop = harness(true, "/view/product/browse/home?viewport=desktop");
  desktop.store.toggleFrame("desktop", false);
  desktop.store.toggleFrame("mobile", true);
  assert.deepEqual(desktop.proposals, [{ viewport: "both" }]);
});

test("a standalone shell commits each viewport that its toggles name", () => {
  const { state, store } = harness(false);
  const viewports: ViewerSelection["viewport"][] = [];
  for (const [name, checked] of [
    ["mobile", false],
    ["desktop", false],
    ["mobile", true],
    ["desktop", false],
  ] as const) {
    store.toggleFrame(name, checked);
    viewports.push(state().selection.viewport);
  }
  assert.deepEqual(viewports, ["desktop", "desktop", "both", "mobile"]);
});

test("the scheme toggles stay with the shell and propose nothing", () => {
  const { proposals, state, store } = harness(true);
  store.toggleFrame("dark", false);
  assert.deepEqual(state().frames, { dark: false, light: true });
  store.toggleFrame("light", false);
  assert.deepEqual(state().frames, { dark: false, light: true });
  assert.deepEqual(proposals, []);
  assert.equal(state().selection.viewport, "both");
});
