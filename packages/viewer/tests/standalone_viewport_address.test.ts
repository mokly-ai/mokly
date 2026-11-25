/**
 * The viewport in a standalone shell's address, under the navigation
 * contract: each destination address names a kept viewport that is not Both,
 * the shown entry's address follows each change of it, and an address
 * without `viewport` shows Both.
 */

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { act, renderHook } from "@testing-library/react";

import type { ViewerSelection } from "../src/host/types.js";
import type { Catalogue } from "../src/shell/catalogue.js";
import { catalogueNavSections } from "../src/shell/nav_model.js";
import { shellContext } from "../src/shell/projection.js";
import { useShellBrowser } from "../src/shell/store_browser.js";
import type { ShellState } from "../src/shell/store_state.js";

import {
  baseModel,
  initialState,
  shellCatalogue,
} from "./disclosure_evidence_fixture.js";
import { unregisterDom } from "./dom_teardown.js";

const ORIGIN = "https://example.test";
const HOME = "/view/product/browse/home/";

/** A screen other than Home. */
function otherScreen(catalogue: Catalogue): string {
  const other = [...catalogue.byPath.keys()].find(
    (path) =>
      `/view/${path}/` !== HOME &&
      catalogue.byPath.get(path)?.kind === "screen",
  );
  assert.ok(other);
  return other;
}

/**
 * A standalone shell's browser binding on `address`. Each step runs its
 * change, then renders the state that the change left, as the shell's store
 * does.
 */
function standalone(t: TestContext, address: string) {
  GlobalRegistrator.register({ url: `${ORIGIN}${address}` });
  const model = baseModel();
  const catalogue = shellCatalogue(model);
  let state = initialState(model, address);
  const hook = renderHook(
    (props: { state: ShellState }) =>
      useShellBrowser({
        catalogue,
        context: shellContext(catalogue.publicModel, props.state.selection),
        interactive: true,
        sections: catalogueNavSections(catalogue),
        setState(action) {
          state = typeof action === "function" ? action(state) : action;
        },
        state: props.state,
      }),
    { initialProps: { state } },
  );
  t.after(async () => {
    hook.unmount();
    await unregisterDom();
  });
  const step = async (change: () => void | Promise<void>) => {
    await act(async () => {
      await change();
    });
    await act(async () => {
      hook.rerender({ state });
    });
  };
  return {
    address: () => window.location.href.slice(ORIGIN.length),
    catalogue,
    /** Open `href` as a frame's link does, once its queued navigation runs. */
    open: (href: string) =>
      step(async () => {
        hook.result.current.navigateFrame(href);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }),
    /** Change the selection's viewport on the shown entry, as a toggle does. */
    choose: (viewport: ViewerSelection["viewport"]) =>
      step(() => {
        state = { ...state, selection: { ...state.selection, viewport } };
      }),
    state: () => state,
    step,
  };
}

test("a navigation names a kept viewport other than Both in its destination address", async (t) => {
  const shell = standalone(t, `${HOME}?viewport=desktop`);
  const other = otherScreen(shell.catalogue);
  await shell.open(`/view/${other}/`);
  assert.equal(shell.address(), `/view/${other}/?viewport=desktop`);
  assert.equal(shell.state().selection.viewport, "desktop");
  // A link that names Both shows both viewports, and its address names none.
  await shell.open(`${HOME}?viewport=both`);
  assert.equal(shell.address(), HOME);
  assert.equal(shell.state().selection.viewport, "both");
});

test("a history step to an address without viewport shows Both", async (t) => {
  const shell = standalone(t, `${HOME}?viewport=desktop`);
  const other = otherScreen(shell.catalogue);
  await shell.step(() => {
    window.history.pushState(null, "", `/view/${other}/`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  const route = shell.state().route.view;
  assert.equal(route.kind === "target" && route.target.entry.path, other);
  assert.equal(shell.state().selection.viewport, "both");
});

test("Both on the shown entry takes the viewport out of its address", async (t) => {
  const shell = standalone(t, HOME);
  await shell.choose("desktop");
  assert.equal(shell.address(), `${HOME}?viewport=desktop`);
  await shell.choose("both");
  assert.equal(shell.address(), HOME);
});
