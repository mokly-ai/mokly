import assert from "node:assert/strict";
import test from "node:test";

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
      href: "https://example.test/view/components/action/",
    }).detailsOpen,
    true,
  );
});
