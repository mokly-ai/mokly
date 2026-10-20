import assert from "node:assert/strict";
import { test } from "node:test";

import { catalogueNavSections } from "../src/shell/nav_model.js";
import { routeFromUrl } from "../src/shell/routes.js";
import { shellStore } from "../src/shell/store_actions.js";
import { createInitialShellState } from "../src/shell/store_initial.js";

import { catalogue, context } from "./shell_state_fixture.js";

/** A standalone store on the home route whose state the test can read. */
function standaloneStore() {
  const route = routeFromUrl(
    catalogue,
    new URL("https://example.test/view/home/"),
  );
  let state = createInitialShellState(catalogue, context, route, undefined);
  const stateRef = { current: state };
  const store = shellStore({
    catalogue,
    context,
    embedded: false,
    interactive: false,
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
  return { state: () => state, store };
}

test("standalone store actions preserve every sequential search byte", () => {
  const { state, store } = standaloneStore();
  const query = "welcome tag:forms";
  for (let index = 1; index <= query.length; index += 1) {
    const raw = query.slice(0, index);
    store.setSearch(raw);
    assert.equal(state().query, raw);
  }

  assert.equal(state().query, query);
  assert.equal(state().selection.search, "welcome");
  assert.deepEqual(state().selection.tags, ["forms"]);
});

test("a released frame collapses only while it is still the expanded frame", () => {
  const { state, store } = standaloneStore();
  store.setExpandedFrame("first");
  store.releaseExpandedFrame("second");
  assert.equal(state().expandedFrame, "first");
  store.releaseExpandedFrame("first");
  assert.equal(state().expandedFrame, undefined);
});
