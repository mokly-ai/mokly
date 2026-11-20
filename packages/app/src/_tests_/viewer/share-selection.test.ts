import assert from "node:assert/strict";
import { test } from "node:test";

import { sharedViewerUrl, shareSelection } from "../../viewer/share-selection";

import { defaults, removed } from "./fixtures";
import { selection } from "./selection-fixture";

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
