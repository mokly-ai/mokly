import assert from "node:assert/strict";
import { test } from "node:test";

import { rawIndexFixture } from "./catalogue_v8_fixture.js";
import { embeddedMarkup, withDarkViews } from "./presentation_v7_helpers.js";

test("the embedded viewer preserves pending entry and saved-variant comparison eligibility", () => {
  for (const screenPath of [
    "product/browse/home",
    "components/action",
  ] as const) {
    const index = rawIndexFixture();
    const entry =
      screenPath === "product/browse/home"
        ? index.screens.find(({ path }) => path === screenPath)!
        : index.components.find(({ path }) => path === screenPath)!;
    entry.changes = { status: "ready", included: true, kind: "changed" };
    // A component route shows its own views first, then its saved variants.
    const shown = [
      entry,
      ...index.components.filter(({ variantOf }) => variantOf === screenPath),
    ];
    for (const record of shown) {
      if ("comparison" in record) record.comparison = { status: "pending" };
      for (const view of record.views) view.comparison = { status: "pending" };
    }

    const html = embeddedMarkup({ index, defaultSelection: { screenPath } });
    assert.match(html, /data-workspace-status="">Changed<\/span>/);
    assert.match(html, /class="mbk-diff-toolbar" hidden=""/);
  }
});

test("the embedded viewer uses effective Light evidence for light-only screens and variants", () => {
  const screenIndex = rawIndexFixture();
  for (const candidate of screenIndex.components)
    if (candidate.variantOf === "components/action") {
      candidate.colorSchemes = ["light", "dark"];
      candidate.views = withDarkViews(candidate.views);
    }
  const home = screenIndex.screens[0]!;
  for (const view of home.views)
    view.comparison = {
      status: "ready",
      kind: "unmodified",
      eligible: false,
    };
  home.changes = { status: "ready", included: true, kind: "changed" };
  const screenHtml = embeddedMarkup({
    index: screenIndex,
    defaultSelection: {
      screenPath: home.path,
      colorScheme: "dark",
      viewport: "both",
    },
  });
  assert.match(screenHtml, /data-workspace-status="">Unmodified<\/span>/);
  assert.match(screenHtml, /class="mbk-diff-toolbar" hidden=""/);

  const componentIndex = rawIndexFixture();
  const screen = componentIndex.screens[0]!;
  screen.colorSchemes = ["light", "dark"];
  screen.views = withDarkViews(screen.views);
  const lightComponent = componentIndex.components[0]!;
  lightComponent.changes = {
    status: "ready",
    included: true,
    kind: "changed",
  };
  const selected = componentIndex.components.find(
    ({ variantOf }) => variantOf === lightComponent.path,
  )!;
  selected.comparison = { status: "ready", kind: "changed", eligible: true };
  for (const view of selected.views)
    view.comparison = { status: "ready", kind: "changed", eligible: true };
  const componentHtml = embeddedMarkup({
    index: componentIndex,
    defaultSelection: {
      screenPath: selected.path,
      colorScheme: "dark",
      viewport: "both",
    },
  });
  assert.match(componentHtml, /data-workspace-status="">Changed<\/span>/);
  assert.match(componentHtml, /data-view-changed="scheme" hidden=""/);
});
