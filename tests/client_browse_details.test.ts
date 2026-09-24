import assert from "node:assert/strict";
import test from "node:test";

import type { ShellRecoverySnapshot } from "../packages/viewer/dist/shell/store_state.js";

import { fixtureShellState } from "./helpers/viewer_catalogue.js";

test("details preference restores either explicit disclosure value", () => {
  assert.equal(
    fixtureShellState({ initial: { detailsOpen: false } }).detailsOpen,
    false,
  );
  assert.equal(
    fixtureShellState({ initial: { detailsOpen: true } }).detailsOpen,
    true,
  );
});

test("details defaults follow the routed workspace when no preference exists", () => {
  assert.equal(fixtureShellState().detailsOpen, false);
  assert.equal(
    fixtureShellState({
      href: "https://example.test/view/components/action.html",
    }).detailsOpen,
    true,
  );
});

test("a native activation captured before hydration wins over older state", () => {
  assert.equal(
    fixtureShellState({
      initial: {
        detailsOpen: false,
        earlyDetailsOpen: true,
        recovery: recovery(false),
      },
    }).detailsOpen,
    true,
  );
});

function recovery(detailsOpen: boolean): ShellRecoverySnapshot {
  return {
    disclosures: {},
    colorScheme: "light",
    detailsOpen,
    drawerOpen: false,
    filterBaselineDisclosures: null,
    navScroll: 0,
    query: "",
    regionScrolls: {},
    view: "all",
    viewport: "both",
  };
}
