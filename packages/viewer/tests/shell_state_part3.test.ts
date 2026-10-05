import assert from "node:assert/strict";
import { test } from "node:test";

import { catalogueNavSections } from "../src/shell/nav_model.js";
import { routeFromUrl } from "../src/shell/routes.js";
import { shellStore } from "../src/shell/store_actions.js";
import { createInitialShellState } from "../src/shell/store_initial.js";

import { catalogue, context } from "./shell_state_fixture.js";

test("standalone store actions preserve every sequential search byte", () => {
  const route = routeFromUrl(
    catalogue,
    new URL("https://example.test/view/home/"),
  );
  let state = createInitialShellState(
    catalogue,
    context,
    route.view,
    undefined,
  );
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
  const query = "welcome tag:forms";
  for (let index = 1; index <= query.length; index += 1) {
    const raw = query.slice(0, index);
    store.setSearch(raw);
    assert.equal(state.query, raw);
  }

  assert.equal(state.query, query);
  assert.equal(state.selection.search, "welcome");
  assert.deepEqual(state.selection.tags, ["forms"]);
});
