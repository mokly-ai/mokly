/**
 * The actions that leave their surface draw the external glyph on every page
 * and in every view the catalogue draws them, as the application does. A
 * protocol doc names each glyph: `product-mockups-account-desktop.md` for the
 * desktop app's sign-in actions and the GitHub actions of its window, and
 * `product-mockups-viewer.md` for Set up publishing.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { ComponentInstanceRecord } from "@mokly/viewer";

import { catalogueEntries, viewUsage } from "./catalogue-index";

/** Each checked action and every page that draws it. */
const outbound = {
  "Continue in browser": [
    "product/account/sign-in/desktop",
    "product/account/sign-up/desktop",
  ],
  "Open browser again": [
    "product/account/sign-in/desktop/waiting",
    "product/account/sign-up/desktop/waiting",
  ],
  "Open Mokly": [
    "product/account/connect-desktop",
    "product/account/connect-desktop/opened",
    "product/account/connect-desktop/session-loading",
  ],
  "Set up publishing": [
    "product/viewer/share/empty",
    "product/viewer/standalone/empty",
    "product/viewer/switcher/no-branches",
  ],
};

/** Every view a page is drawn in, with the glyph each one must carry. */
const everyView = [
  "desktop dark: external",
  "desktop light: external",
  "mobile dark: external",
  "mobile light: external",
];

/** One string prop of a drawn instance, or nothing when it is absent. */
function stringProp(
  instance: ComponentInstanceRecord,
  name: string,
): string | undefined {
  const value = instance.props[name];
  return value?.[0] === "string" ? value[1] : undefined;
}

/** For one action label, the glyph each page draws beside it, per view. */
function drawnGlyphs(label: string): Record<string, string[]> {
  const pages: Record<string, string[]> = {};
  for (const entry of catalogueEntries()) {
    if (entry.kind !== "screen") continue;
    for (const view of viewUsage(entry.path))
      for (const instance of view.instances) {
        if (instance.componentId !== "design/button") continue;
        if (stringProp(instance, "label") !== label) continue;
        const glyph = stringProp(instance, "icon") ?? "none";
        (pages[entry.path] ??= []).push(
          view.viewport + " " + view.colorScheme + ": " + glyph,
        );
      }
  }
  for (const views of Object.values(pages)) views.sort();
  return pages;
}

test("the actions that leave their surface draw the external glyph in every view", () => {
  for (const [label, pages] of Object.entries(outbound))
    assert.deepEqual(
      drawnGlyphs(label),
      Object.fromEntries(pages.map((page) => [page, everyView])),
      label,
    );
});

test("in the desktop app's window each GitHub action trades its own glyph for the external one", () => {
  // Each action keeps its label in the window, so the browser drawings of the
  // same label must still carry the action's own glyph.
  for (const [label, inWindow, own] of [
    ["Connect GitHub", "product/settings/account/desktop", "github"],
    ["Add GitHub account", "product/settings/github/desktop", "start"],
    ["Install on GitHub", "product/account/install-app/desktop", "github"],
  ] as const) {
    const drawn = drawnGlyphs(label);
    assert.deepEqual(drawn[inWindow], everyView, label);
    const browser = Object.entries(drawn).filter(([page]) => page !== inWindow);
    assert.ok(browser.length > 0, label + " is drawn in a browser");
    for (const [page, views] of browser)
      assert.deepEqual(
        views,
        everyView.map((view) => view.replace("external", own)),
        label + " on " + page,
      );
  }
});
