import assert from "node:assert/strict";
import { test } from "node:test";

import { readViewerState, viewerHref } from "../../viewer/selection";

import { defaults, removed } from "./fixtures";
import { selection } from "./selection-fixture";

test("an address with no state reads the defaults and corrects nothing", () => {
  const { state, corrected } = readViewerState({}, defaults);
  assert.deepEqual(state, {
    selection: {
      view: "all",
      screen: undefined,
      viewport: "both",
      scheme: "light",
      search: "",
      tags: [],
    },
    panel: undefined,
  });
  assert.equal(corrected, false);
});

test("the check link lands on Changes without being corrected", () => {
  const { state, corrected } = readViewerState({ view: "changes" }, defaults);
  assert.equal(state.selection.view, "changes");
  assert.equal(corrected, false);
});

test("the signed-in preference supplies the scheme the address omits", () => {
  const { state } = readViewerState({}, { scheme: "dark" });
  assert.equal(state.selection.scheme, "dark");
});

test("a value this publication cannot honour falls back and says so", () => {
  for (const query of [
    { view: "diff" },
    { viewport: "tablet" },
    { scheme: "sepia" },
    { panel: "everything" },
    { view: "" },
    { viewport: ["desktop", "mobile"] },
  ]) {
    const { state, corrected } = readViewerState(query, defaults);
    assert.equal(corrected, true, JSON.stringify(query));
    assert.equal(state.selection.view, "all");
    assert.equal(state.selection.viewport, "both");
    assert.equal(state.selection.scheme, "light");
    assert.equal(state.panel, undefined);
  }
});

test("a routed entry stays package-owned", () => {
  const { state, corrected } = readViewerState(
    { catalogueScreen: "start" },
    defaults,
  );
  assert.equal(state.selection.screen, "start");
  assert.equal(corrected, false);
});

test("a component variant is selected by its own entry path", () => {
  const result = readViewerState({ catalogueScreen: "notice/draft" }, defaults);
  assert.equal(result.state.selection.screen, "notice/draft");
  assert.equal("snapshotId" in result.state.selection, false);
  assert.equal(result.corrected, false);
});

test("the complete package selection is preserved in address state", () => {
  const { state, corrected } = readViewerState(
    {
      catalogueScreen: removed.screen,
      catalogueSnapshot: removed.snapshotId,
      view: "changes",
      viewport: "both",
      scheme: "dark",
      search: "checkout form",
      tag: ["forms", "critical"],
    },
    defaults,
  );
  assert.deepEqual(
    state.selection,
    selection({
      screen: removed.screen,
      snapshotId: removed.snapshotId,
      view: "changes",
      viewport: "both",
      scheme: "dark",
      search: "checkout form",
      tags: ["forms", "critical"],
    }),
  );
  assert.equal(corrected, false);
});

test("tags normalize once and malformed tag addresses are corrected", () => {
  const normalized = readViewerState({ tag: ["Forms", "CRITICAL"] }, defaults);
  assert.deepEqual(normalized.state.selection.tags, ["forms", "critical"]);
  assert.equal(normalized.corrected, true);

  for (const tag of ["", "two words", ["forms", "forms"]]) {
    const result = readViewerState({ tag }, defaults);
    assert.deepEqual(result.state.selection.tags, []);
    assert.equal(result.corrected, true, JSON.stringify(tag));
  }
});

test("the address names the reader's own choices and nothing else", () => {
  const path = "/acme/website/publications/p1";
  assert.equal(viewerHref(path, { selection: selection() }, defaults), path);
  assert.equal(
    viewerHref(
      path,
      {
        selection: selection({
          view: "changes",
          screen: removed.screen,
          snapshotId: removed.snapshotId,
          viewport: "mobile",
          scheme: "dark",
          search: "checkout form",
          tags: ["forms", "critical"],
        }),
        panel: "history",
      },
      defaults,
    ),
    path +
      `?view=changes&catalogueScreen=${encodeURIComponent(removed.screen)}` +
      `&catalogueSnapshot=${removed.snapshotId}&viewport=mobile` +
      "&scheme=dark&search=checkout+form&tag=forms&tag=critical" +
      "&panel=history",
  );
  // The default scheme is the reader's own preference, not a value to write
  // into a link somebody else opens.
  assert.equal(
    viewerHref(
      path,
      { selection: selection({ scheme: "dark" }) },
      { scheme: "dark" },
    ),
    path,
  );
});

test("an address round-trips through the state it describes", () => {
  const path = "/acme/website/publications/p1";
  const query = {
    view: "changes",
    catalogueScreen: removed.screen,
    catalogueSnapshot: removed.snapshotId,
    viewport: "desktop",
    scheme: "dark",
    search: "checkout",
    tag: ["forms", "critical"],
    panel: "share",
  };
  const { state, corrected } = readViewerState(query, defaults);
  assert.equal(corrected, false);
  assert.equal(
    viewerHref(path, state, defaults),
    path +
      `?view=changes&catalogueScreen=${encodeURIComponent(removed.screen)}` +
      `&catalogueSnapshot=${removed.snapshotId}&viewport=desktop&scheme=dark` +
      "&search=checkout&tag=forms&tag=critical&panel=share",
  );
});

test("a single viewport is written and Both, the default, is left out", () => {
  const path = "/acme/website/publications/p1";
  for (const viewport of ["desktop", "mobile"] as const) {
    const read = readViewerState({ viewport }, defaults);
    assert.equal(read.state.selection.viewport, viewport);
    assert.equal(read.corrected, false, viewport);
    assert.equal(
      viewerHref(path, read.state, defaults),
      `${path}?viewport=${viewport}`,
    );
  }
  // A link that names the default is still valid, so the route keeps it as it
  // is, and the next address the viewer writes over it leaves Both out.
  const both = readViewerState({ viewport: "both" }, defaults);
  assert.equal(both.state.selection.viewport, "both");
  assert.equal(both.corrected, false);
  assert.equal(viewerHref(path, both.state, defaults, "?viewport=both"), path);
});

test("a panel that needs a publication is not opened over nothing", () => {
  const nothing = { ...defaults, publication: false };
  const share = readViewerState({ panel: "share" }, nothing);
  assert.equal(share.state.panel, undefined);
  assert.equal(share.corrected, true);
  // The switcher is how a reader finds a reference that has published, so it
  // stays open on a project that has not.
  const switcher = readViewerState({ panel: "switcher" }, nothing);
  assert.equal(switcher.state.panel, "switcher");
  assert.equal(switcher.corrected, false);
  // With a publication, sharing is exactly what the panel is for.
  const ready = readViewerState(
    { panel: "share" },
    {
      ...defaults,
      publication: true,
    },
  );
  assert.equal(ready.state.panel, "share");
  assert.equal(ready.corrected, false);
});

test("an address keeps the keys the viewer does not own", () => {
  const path = "/acme/website/publications/p1";
  const state = {
    selection: selection(),
  };
  // A corrected viewer value must not take the settings dialog down with it:
  // each surface edits only the keys it owns, in both directions.
  assert.equal(
    viewerHref(path, state, defaults, "?scheme=blue&settings=account"),
    path + "?settings=account",
  );
  assert.equal(
    viewerHref(path, { ...state, panel: "history" }, defaults, "?settings="),
    path + "?settings=&panel=history",
  );
});
