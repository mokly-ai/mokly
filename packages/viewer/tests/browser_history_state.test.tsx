import assert from "node:assert/strict";
import { test } from "node:test";

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { act, renderHook } from "@testing-library/react";

import { catalogueNavSections } from "../src/shell/nav_model.js";
import { shellContext } from "../src/shell/projection.js";
import { useShellBrowser } from "../src/shell/store_browser.js";
import type { ShellState } from "../src/shell/store_state.js";

import {
  baseModel,
  initialState,
  shellCatalogue,
} from "./disclosure_evidence_fixture.js";

const ORIGIN = "https://example.test";
const HOME = "product/browse/home";

/**
 * The history state that an earlier viewer wrote on each entry: the scroll
 * position of each shell region, which this viewer no longer keeps. It
 * holds a malformed value too, as stored history can.
 */
const EARLIER_STATE = { scrolls: { stage: 120, inspector: "top" } };

/** The entry path that a shell state's route shows. */
function shownPath(state: ShellState): string {
  const view = state.route.view;
  return view.kind === "target" ? view.target.entry.path : view.kind;
}

test("history entries that an earlier viewer wrote load and navigate", async (t) => {
  GlobalRegistrator.register({ url: `${ORIGIN}/view/${HOME}/` });
  t.after(() => GlobalRegistrator.unregister());
  const model = baseModel();
  const catalogue = shellCatalogue(model);
  const other = [...catalogue.byPath.keys()].find(
    (path) => path !== HOME && catalogue.byPath.get(path)?.kind === "screen",
  );
  assert.ok(other);
  let state = initialState(model, `/view/${HOME}/`);
  // The current entry and the entry that Back returns to both carry the
  // earlier viewer's state.
  window.history.replaceState(EARLIER_STATE, "", `/view/${HOME}/`);
  const { unmount } = renderHook(() =>
    useShellBrowser({
      catalogue,
      context: shellContext(catalogue.publicModel, state.selection),
      interactive: true,
      sections: catalogueNavSections(catalogue),
      setState(action) {
        state = typeof action === "function" ? action(state) : action;
      },
      state,
    }),
  );
  try {
    assert.equal(shownPath(state), HOME);
    window.history.pushState(EARLIER_STATE, "", `/view/${other}/`);
    await act(async () => {
      assert.doesNotThrow(() =>
        window.dispatchEvent(
          new PopStateEvent("popstate", { state: EARLIER_STATE }),
        ),
      );
    });
    assert.equal(shownPath(state), other);
  } finally {
    unmount();
  }
});
