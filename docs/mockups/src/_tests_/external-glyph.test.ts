/**
 * Open Mokly and Set up publishing draw the external glyph on every page and in
 * every view the catalogue draws them, as the application does. A protocol doc
 * names each glyph: `product-mockups-account.md` for Open Mokly, and
 * `product-mockups-viewer.md` for Set up publishing.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { ComponentInstanceRecord } from "@mokly/viewer";

import { catalogueEntries, viewUsage } from "./catalogue-index";

/** Each checked action and every page that draws it. */
const outbound = {
  "Open Mokly": ["product/account/callback/desktop"],
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

test("Open Mokly and Set up publishing draw the external glyph in every view", () => {
  for (const [label, pages] of Object.entries(outbound))
    assert.deepEqual(
      drawnGlyphs(label),
      Object.fromEntries(pages.map((page) => [page, everyView])),
      label,
    );
});
