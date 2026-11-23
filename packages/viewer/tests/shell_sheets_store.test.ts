import assert from "node:assert/strict";
import test from "node:test";

import { catalogueNavSections } from "../src/shell/nav_model.js";
import { shellContext } from "../src/shell/projection.js";
import { routeFromUrl } from "../src/shell/routes.js";
import { shellStore } from "../src/shell/store_actions.js";
import { installShellRoute } from "../src/shell/store_routes.js";
import type { ShellState } from "../src/shell/store_state.js";

import {
  baseModel,
  initialState,
  shellCatalogue,
} from "./disclosure_evidence_fixture.js";

/** A standalone store over the public fixture, from a state on `route`. */
function harness(route: string) {
  const model = baseModel();
  const catalogue = shellCatalogue(model);
  let state = initialState(model, route);
  const stateRef = { current: state };
  const store = shellStore({
    catalogue,
    context: shellContext(catalogue.publicModel, state.selection),
    embedded: false,
    interactive: true,
    navigation: {
      navigateFrame() {},
      onShellClick() {},
      onShellKeyDown() {},
      openFrame() {},
    },
    propose() {},
    sections: catalogueNavSections(catalogue),
    setState(action) {
      state = typeof action === "function" ? action(state) : action;
      stateRef.current = state;
    },
    state,
    stateRef,
  });
  return { catalogue, state: () => state, store };
}

/** The sheet state of a shell state. */
function sheet(state: ShellState) {
  return [state.sheet, state.sheetExpanded];
}

test("one sheet opens at a time, at its compact height, until it closes", () => {
  const { state, store } = harness("/view/product/browse/home");
  assert.deepEqual(sheet(state()), [undefined, false]);
  store.setSheet("catalogue");
  assert.deepEqual(sheet(state()), ["catalogue", false]);
  store.setSheetExpanded(true);
  assert.deepEqual(sheet(state()), ["catalogue", true]);
  store.setSheet("panel");
  assert.deepEqual(sheet(state()), ["panel", false]);
  store.setSheet(undefined);
  assert.deepEqual(sheet(state()), [undefined, false]);
});

test("a navigation closes the catalogue's sheet and keeps the panel's sheet while an entry shows", () => {
  const { catalogue, state } = harness("/view/product/browse/home");
  const sections = catalogueNavSections(catalogue);
  const install = (from: ShellState, path: string) =>
    sheet(
      installShellRoute(
        from,
        routeFromUrl(catalogue, new URL(`https://example.test${path}`)),
        catalogue,
        sections,
        "standalone",
      ),
    );
  const entry = "/view/product/browse/home";
  const open = (name: "catalogue" | "panel"): ShellState => ({
    ...state(),
    sheet: name,
    sheetExpanded: true,
  });
  assert.deepEqual(install(open("catalogue"), entry), [undefined, false]);
  assert.deepEqual(install(open("panel"), entry), ["panel", true]);
  assert.deepEqual(install(open("panel"), "/"), [undefined, false]);
});

test("the chosen catalogue width persists until a reset forgets it", (context) => {
  const saved = new Map<string, string>();
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => saved.get(key) ?? null,
      removeItem: (key: string) => saved.delete(key),
      setItem: (key: string, value: string) => saved.set(key, value),
    },
  });
  context.after(() => {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else Reflect.deleteProperty(globalThis, "localStorage");
  });
  const { state, store } = harness("/");
  assert.equal(state().navigationWidth, undefined);
  store.setNavigationWidth(300);
  store.persistNavigationWidth(300);
  assert.equal(state().navigationWidth, 300);
  assert.equal(saved.get("mokly:navigation-width:v1"), "300");
  store.resetNavigationWidth();
  assert.equal(state().navigationWidth, undefined);
  assert.equal(saved.has("mokly:navigation-width:v1"), false);
});
