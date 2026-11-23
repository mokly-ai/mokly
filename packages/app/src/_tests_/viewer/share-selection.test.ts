import assert from "node:assert/strict";
import { test } from "node:test";

import { shareSelection } from "../../viewer/share-selection";

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

test("Share requests a single viewport and leaves Both, the default, out", () => {
  // A link without a viewport opens on Both, so each recipient opens the
  // viewport the reader shared from.
  for (const [viewport, requested] of [
    ["desktop", "desktop"],
    ["mobile", "mobile"],
    ["both", undefined],
  ] as const) {
    assert.deepEqual(
      shareSelection(
        selection({ screen: "start", viewport, scheme: "dark" }),
        defaults,
        { path: "start", scheme: "dark" },
      ),
      { screen: "start", viewport: requested, scheme: "dark" },
      viewport,
    );
  }
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
