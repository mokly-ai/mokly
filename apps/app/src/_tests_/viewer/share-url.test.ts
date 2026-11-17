import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import { readQuery } from "../../navigation/address";
import type { ViewerSelection } from "../../viewer/host";
import { readViewerState, viewerHref } from "../../viewer/selection";
import { repositoryRoot } from "../root";

import { defaults } from "./fixtures";

function selection(over: Partial<ViewerSelection> = {}): ViewerSelection {
  return {
    view: "all",
    viewport: "desktop",
    scheme: "light",
    search: "",
    tags: [],
    ...over,
  };
}

// The same file mkc-api's share projection test reads.
const minted = readFileSync(
  resolve(repositoryRoot, "fixtures/viewer-share-url.txt"),
  "utf8",
).trimEnd();

test("the API's minted URL opens its screen and round-trips through viewerHref", () => {
  const url = new URL(minted);
  const { state, corrected } = readViewerState(readQuery(url.search), defaults);
  assert.equal(state.selection.screen, "Product/Welcome_1");
  assert.equal(state.selection.viewport, "mobile");
  assert.equal(state.selection.scheme, "dark");
  assert.equal(corrected, false);
  const written = new URL(
    viewerHref(url.pathname, state, defaults, url.search),
    url,
  );
  // The key the application writes back is the key the API mints: one name for
  // the catalogue screen on canonical app URLs and working addresses alike.
  assert.equal(
    written.searchParams.get("catalogueScreen"),
    "Product/Welcome_1",
  );
  assert.deepEqual(
    readViewerState(readQuery(written.search), defaults).state,
    state,
  );

  for (const screen of ["finish", undefined]) {
    const next = { ...state, selection: { ...state.selection, screen } };
    const changed = new URL(
      viewerHref(url.pathname, next, defaults, url.search),
      url,
    );
    assert.equal(
      readViewerState(readQuery(changed.search), defaults).state.selection
        .screen,
      screen,
    );
  }
});

test("the reserved key is never read and never written", () => {
  // React Navigation reserves `screen` for navigating into a nested navigator.
  // Nothing here reads it, so an address carrying one selects no screen, and
  // nothing here writes it, so the router never learns a value of it.
  const legacy = readViewerState(readQuery("?screen=finish"), defaults);
  assert.equal(legacy.state.selection.screen, undefined);

  const written = new URL(
    viewerHref(
      "/acme/website/publications/p1",
      {
        selection: selection({
          view: "all",
          screen: "start",
        }),
      },
      defaults,
      "?settings=account",
    ),
    "https://app.example.com",
  );
  assert.equal(written.searchParams.has("screen"), false);
  assert.equal(written.searchParams.get("catalogueScreen"), "start");
  // A key the viewer does not own is not a key it clears.
  assert.equal(written.searchParams.get("settings"), "account");
});

test("a routed entry remains package-owned", () => {
  const routed = readViewerState(
    readQuery("?catalogueScreen=removed&view=changes"),
    defaults,
  );
  assert.equal(routed.state.selection.view, "changes");
  assert.equal(routed.state.selection.screen, "removed");
  assert.equal(routed.corrected, false);
});
