import assert from "node:assert/strict";
import { test } from "node:test";

import { readViewerState, viewerHref } from "../../viewer/selection";
import { shareSelection } from "../../viewer/share-selection";

import { defaults } from "./fixtures";

test("valid entry paths keep their case and share identity", () => {
  for (const catalogueScreen of [
    "Start",
    "product/Start_here-2",
    "a".repeat(2048),
    "_pages/node_modules/start",
  ]) {
    const { state, corrected } = readViewerState({ catalogueScreen }, defaults);
    assert.equal(corrected, false, catalogueScreen);
    assert.equal(state.selection.screen, catalogueScreen);
    assert.equal(
      shareSelection(state.selection, defaults, {
        path: catalogueScreen,
        scheme: "light",
      }).screen,
      catalogueScreen,
    );
    const url = new URL(
      viewerHref("/org/project", state, defaults),
      "https://app.example",
    );
    assert.equal(url.searchParams.get("catalogueScreen"), catalogueScreen);
  }
});

test("invalid paths clear their snapshots and preserve other address state", () => {
  for (const catalogueScreen of [
    "",
    "/start",
    "start/",
    "a//b",
    "a.b",
    "a b",
    "a\\b",
    "a/../b",
    "a/CON",
    "aux/b",
    "a/LpT9",
    "MOKLY-generated/a",
    "a%2Fb",
    "é",
    "a\n",
    "a".repeat(2049),
    ["a", "b"],
  ]) {
    const query = {
      catalogueScreen,
      catalogueSnapshot: "a".repeat(64),
      settings: "account",
      viewport: "mobile",
      search: "checkout",
    };
    const { state, corrected } = readViewerState(query, defaults);
    assert.equal(corrected, true, JSON.stringify(catalogueScreen));
    assert.equal(state.selection.screen, undefined);
    assert.equal(state.selection.snapshotId, undefined);
    if (typeof catalogueScreen === "string") {
      assert.equal(
        shareSelection(
          { ...state.selection, screen: catalogueScreen },
          defaults,
          { path: catalogueScreen, scheme: "light" },
        ).screen,
        undefined,
      );
    }
    const url = new URL(
      viewerHref("/org/project", state, defaults, "?settings=account"),
      "https://app.example",
    );
    assert.equal(url.searchParams.get("settings"), "account");
    assert.equal(url.searchParams.get("viewport"), "mobile");
    assert.equal(url.searchParams.get("search"), "checkout");
  }
});
