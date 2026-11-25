import assert from "node:assert/strict";
import { test } from "node:test";

import { readQuery } from "../../navigation/query";
import type { ViewerSelection } from "../../viewer/host";
import {
  carriedQuery,
  readViewerState,
  referenceResolutionHref,
  viewerHref,
} from "../../viewer/selection";

import { defaults, removed } from "./fixtures";

const path = "/acme/website/publications/p1";

function selection(over: Partial<ViewerSelection> = {}): ViewerSelection {
  return {
    view: "all",
    viewport: "both",
    scheme: "light",
    search: "",
    tags: [],
    ...over,
  };
}

test("a snapshot names one previous version of its screen", () => {
  const { state, corrected } = readViewerState(
    { catalogueScreen: removed.screen, catalogueSnapshot: removed.snapshotId },
    defaults,
  );
  assert.equal(state.selection.screen, removed.screen);
  assert.equal(state.selection.snapshotId, removed.snapshotId);
  assert.equal(corrected, false);
});

test("a snapshot that is not one 64-hex identity is corrected away", () => {
  for (const catalogueSnapshot of [
    removed.snapshotId.toUpperCase(),
    removed.snapshotId.slice(1),
    removed.snapshotId + "0",
    "g".repeat(64),
    "",
    [removed.snapshotId, removed.snapshotId],
  ]) {
    const label = JSON.stringify(catalogueSnapshot);
    const { state, corrected } = readViewerState(
      { catalogueScreen: removed.screen, catalogueSnapshot },
      defaults,
    );
    assert.equal(corrected, true, label);
    // The screen the reader named is still theirs; only the value the package
    // would refuse outright goes.
    assert.equal(state.selection.screen, removed.screen, label);
    assert.equal("snapshotId" in state.selection, false, label);
  }
});

test("a snapshot without a screen is corrected away", () => {
  for (const query of [
    { catalogueSnapshot: removed.snapshotId },
    { catalogueScreen: "", catalogueSnapshot: removed.snapshotId },
    {
      catalogueScreen: ["start", "finish"],
      catalogueSnapshot: removed.snapshotId,
    },
  ]) {
    const label = JSON.stringify(query);
    const { state, corrected } = readViewerState(query, defaults);
    assert.equal(corrected, true, label);
    assert.equal(state.selection.screen, undefined, label);
    assert.equal("snapshotId" in state.selection, false, label);
  }
});

test("a snapshot's membership stays the package's", () => {
  // A well-formed identity this cloud cannot check against the catalogue is
  // handed over untouched: an unknown or stale record is the package's own
  // unavailable state, not a value the host resets.
  const unknown = "f".repeat(64);
  const { state, corrected } = readViewerState(
    { catalogueScreen: "start", catalogueSnapshot: unknown },
    defaults,
  );
  assert.equal(state.selection.snapshotId, unknown);
  assert.equal(corrected, false);
});

test("a correction drops the malformed snapshot and keeps everything else", () => {
  const search =
    "?settings=account&catalogueScreen=product%2Fbrowse%2Fhome%2Fretired" +
    "&catalogueSnapshot=ABC&viewport=mobile";
  const { state, corrected } = readViewerState(readQuery(search), defaults);
  assert.equal(corrected, true);
  assert.equal(
    viewerHref(path, state, defaults, search),
    path +
      "?settings=account&catalogueScreen=product%2Fbrowse%2Fhome%2Fretired&viewport=mobile",
  );
});

test("a snapshot is written beside its screen and round-trips", () => {
  const selected = selection({
    screen: removed.screen,
    snapshotId: removed.snapshotId,
    viewport: "mobile",
  });
  const written = viewerHref(path, { selection: selected }, defaults);
  assert.equal(
    written,
    path +
      `?catalogueScreen=${encodeURIComponent(removed.screen)}` +
      `&catalogueSnapshot=${removed.snapshotId}&viewport=mobile`,
  );
  const read = readViewerState(
    readQuery(new URL(written, "https://app.example.com").search),
    defaults,
  );
  assert.equal(read.corrected, false);
  assert.deepEqual(read.state.selection, selected);
});

test("returning to current content takes the snapshot off the address", () => {
  const search =
    `?catalogueScreen=${encodeURIComponent(removed.screen)}` +
    `&catalogueSnapshot=${removed.snapshotId}`;
  assert.equal(
    viewerHref(
      path,
      { selection: selection({ screen: "start" }) },
      defaults,
      search,
    ),
    path + "?catalogueScreen=start",
  );
});

test("an old variant link drops its key and invents no entry", () => {
  const search = "?catalogueScreen=notice&variantId=draft&viewport=mobile";
  const { state, corrected } = readViewerState(readQuery(search), defaults);
  // Variants are entries with paths of their own, which only the catalogue
  // knows: the parent stays selected and the retired key goes.
  assert.equal(corrected, true);
  assert.equal(state.selection.screen, "notice");
  assert.equal("snapshotId" in state.selection, false);
  const written = viewerHref(path, state, defaults, search);
  assert.equal(written, path + "?catalogueScreen=notice&viewport=mobile");
  assert.doesNotMatch(written, /notice%2Fdraft|variantId/);

  for (const query of [{ variantId: "draft" }, { variantId: "" }]) {
    assert.equal(readViewerState(query, defaults).corrected, true);
  }
});

test("a resolution carries the snapshot with its screen", () => {
  const carried = new URLSearchParams(
    carriedQuery(
      `?branch=main&catalogueScreen=${encodeURIComponent(removed.screen)}` +
        `&catalogueSnapshot=${removed.snapshotId}`,
    ),
  );
  assert.equal(carried.has("branch"), false);
  assert.equal(carried.get("catalogueScreen"), removed.screen);
  assert.equal(carried.get("catalogueSnapshot"), removed.snapshotId);
});

test("a resolution corrects an old variant key away", () => {
  const search =
    "?branch=main&catalogueScreen=notice&variantId=draft&settings=tokens";
  const { state, corrected } = readViewerState(readQuery(search), defaults);
  assert.equal(corrected, true);
  assert.equal(
    referenceResolutionHref(
      "/acme/site/publications/p1",
      search,
      state,
      defaults,
      corrected,
    ),
    "/acme/site/publications/p1?catalogueScreen=notice&settings=tokens",
  );
});
