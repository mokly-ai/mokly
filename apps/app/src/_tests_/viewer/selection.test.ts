import assert from "node:assert/strict";
import { test } from "node:test";

import type { ViewerSelection } from "../../viewer/host";
import {
  carriedQuery,
  readViewerState,
  referenceResolutionHref,
  viewerHref,
} from "../../viewer/selection";
import { sharedViewerUrl, shareSelection } from "../../viewer/share-selection";

import { defaults, removed } from "./fixtures";

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

test("an address with no state reads the defaults and corrects nothing", () => {
  const { state, corrected } = readViewerState({}, defaults);
  assert.deepEqual(state, {
    selection: {
      view: "all",
      screen: undefined,
      viewport: "desktop",
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
    assert.equal(state.selection.viewport, "desktop");
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
          viewport: "both",
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
      `&catalogueSnapshot=${removed.snapshotId}&viewport=both` +
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
    viewport: "both",
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
      `&catalogueSnapshot=${removed.snapshotId}&viewport=both&scheme=dark` +
      "&search=checkout&tag=forms&tag=critical&panel=share",
  );
});

test("a share link pins the screen and how it is drawn, never the panel", () => {
  assert.deepEqual(
    shareSelection(
      selection({
        view: "changes",
        screen: "start",
        snapshotId: removed.snapshotId,
        viewport: "mobile",
        scheme: "dark",
        search: "checkout",
        tags: ["forms"],
      }),
      defaults,
      { path: "start", scheme: "dark" },
    ),
    { screen: "start", viewport: "mobile", scheme: "dark" },
  );
  // A value the reader never moved is their own preference, not a choice to
  // write into a link somebody else opens.
  assert.deepEqual(shareSelection(selection(), defaults, undefined), {
    screen: undefined,
    viewport: undefined,
    scheme: undefined,
  });
  assert.deepEqual(
    shareSelection(
      selection({ scheme: "dark" }),
      {
        scheme: "dark",
      },
      undefined,
    ),
    { screen: undefined, viewport: undefined, scheme: undefined },
  );
  assert.deepEqual(
    shareSelection(selection({ screen: "start", viewport: "both" }), defaults, {
      path: "start",
      scheme: "light",
    }),
    { screen: "start", viewport: undefined, scheme: undefined },
  );
  // Under Dark the viewer shows a screen with no dark view through its light
  // view, so the link names that light view whatever the reader prefers.
  for (const reader of [defaults, { scheme: "dark" as const }])
    assert.deepEqual(
      shareSelection(selection({ screen: "start", scheme: "dark" }), reader, {
        path: "start",
        scheme: "light",
      }),
      { screen: "start", viewport: undefined, scheme: "light" },
      "reader prefers " + reader.scheme,
    );
});

test("Both stays out of the API input and on the URL its recipient opens", () => {
  const selected = selection({
    screen: "start",
    viewport: "both",
    scheme: "dark",
  });
  assert.deepEqual(
    shareSelection(selected, defaults, { path: "start", scheme: "dark" }),
    {
      screen: "start",
      viewport: undefined,
      scheme: "dark",
    },
  );

  const canonical =
    "https://app.example.com/acme/website/publications/publication" +
    "?catalogueScreen=start&scheme=dark";
  assert.equal(
    sharedViewerUrl(canonical, selected),
    canonical + "&viewport=both",
  );
  assert.equal(
    sharedViewerUrl(
      "https://app.example.com/acme/website/publications/publication" +
        "?catalogueScreen=start&viewport=mobile",
      selection({ screen: "start", viewport: "mobile" }),
    ),
    "https://app.example.com/acme/website/publications/publication" +
      "?catalogueScreen=start&viewport=mobile",
  );
});

test("current-only sharing omits a real package selection without erasing it", () => {
  const selected = selection({
    screen: removed.screen,
    snapshotId: removed.snapshotId,
    viewport: "both",
    scheme: "dark",
    search: "checkout",
    tags: ["forms"],
  });
  assert.deepEqual(shareSelection(selected, defaults, undefined), {
    screen: undefined,
    viewport: undefined,
    scheme: "dark",
  });
  assert.deepEqual(
    selected,
    selection({
      screen: removed.screen,
      snapshotId: removed.snapshotId,
      viewport: "both",
      scheme: "dark",
      search: "checkout",
      tags: ["forms"],
    }),
  );
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

test("a resolution carries every key but the ones it must drop", () => {
  const carried = new URLSearchParams(
    carriedQuery(
      "?branch=main&screen=corrupt&catalogueScreen=start" +
        `&catalogueSnapshot=${removed.snapshotId}&settings=account` +
        "&viewport=both&search=checkout&tag=forms&tag=critical",
    ),
  );
  // The reference the alias named has been replaced by a publication.
  assert.equal(carried.has("branch"), false);
  // React Navigation reserves `screen`, and a resolution is the one place a
  // query the reader supplied crosses into a router navigation. Asserted here
  // rather than through the browser because the router consumes the key
  // itself: the address looks the same either way, so only the application's
  // own rule can be measured, and this is what measures it.
  assert.equal(carried.has("screen"), false);
  // Everything else is the reader's, including a key the viewer does not own.
  assert.equal(carried.get("catalogueScreen"), "start");
  assert.equal(carried.get("settings"), "account");
  assert.equal(carried.get("catalogueSnapshot"), removed.snapshotId);
  assert.equal(carried.get("viewport"), "both");
  assert.equal(carried.get("search"), "checkout");
  assert.deepEqual(carried.getAll("tag"), ["forms", "critical"]);
});

test("a reference resolution preserves untouched query bytes and order", () => {
  const search =
    "?branch=review%26docs%2Bplus%23notes%2F%C3%A9quipe" +
    "&settings=tokens&view=changes&catalogueScreen=notice%2Fdraft" +
    "&viewport=both&scheme=dark&search=notice&tag=a&tag=b" +
    "&handoff=one%26two+literal%2Bplus%23notes&screen=reserved";
  const carried =
    "settings=tokens&view=changes&catalogueScreen=notice%2Fdraft" +
    "&viewport=both&scheme=dark&search=notice&tag=a&tag=b" +
    "&handoff=one%26two+literal%2Bplus%23notes";
  const state = {
    selection: selection({
      view: "changes",
      screen: "notice/draft",
      viewport: "both",
      scheme: "dark",
      search: "notice",
      tags: ["a", "b"],
    }),
  };

  assert.equal(carriedQuery(search), carried);
  assert.equal(
    referenceResolutionHref(
      "/acme/site/publications/p1",
      search,
      state,
      defaults,
      false,
    ),
    `/acme/site/publications/p1?${carried}`,
  );
});

test("a resolution with nothing to carry writes no query", () => {
  assert.equal(carriedQuery(""), "");
  assert.equal(carriedQuery("?branch=main&screen=corrupt"), "");
});
