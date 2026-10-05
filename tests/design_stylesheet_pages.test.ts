import assert from "node:assert/strict";
import { test } from "node:test";

import { designCatalogue } from "./helpers/design_catalogue.js";

const DESIGN = "examples/basic/entries/design";
const STYLESHEETS = `${DESIGN}/review/impact/stylesheets`;
const GALLERY = [
  "Design",
  "Mokly design",
  "Changes",
  "Impact states",
  "Stylesheet evidence",
];

/** One page of the gallery: its folder, its own source module and screens. */
interface StylesheetPage {
  navPath: string[];
  sourcePath: string;
  ids: string[];
}

/**
 * The parent page keeps one canonical screen in its existing module. Each
 * child page has its own directory, named under the parent's path.
 */
const PAGES: StylesheetPage[] = [
  {
    navPath: GALLERY,
    sourcePath: `${DESIGN}/review_style_screens.tsx`,
    ids: ["design-review-style-page"],
  },
  {
    navPath: [...GALLERY, "Matched and excluded"],
    sourcePath: `${STYLESHEETS}/matched-excluded/screens.tsx`,
    ids: [
      "design-review-style-excluded",
      "design-review-style-excluded-only",
      "design-review-style-matched",
    ],
  },
  {
    navPath: [...GALLERY, "Unresolved and unnamed"],
    sourcePath: `${STYLESHEETS}/unresolved-unnamed/screens.tsx`,
    ids: ["design-review-style-unnamed", "design-review-style-unresolved"],
  },
];

test("the stylesheet evidence page shows one canonical screen and links two child pages", async () => {
  const { manifest } = await designCatalogue;
  const pages = new Map<string, StylesheetPage>();
  for (const entry of manifest.entries) {
    if (
      entry.kind !== "screen" ||
      !GALLERY.every((label, index) => entry.navPath[index] === label)
    )
      continue;
    const key = entry.navPath.join(" › ");
    const page = pages.get(key) ?? {
      navPath: [...entry.navPath],
      sourcePath: entry.sourcePath,
      ids: [],
    };
    assert.equal(entry.sourcePath, page.sourcePath, entry.id);
    page.ids.push(entry.id);
    pages.set(key, page);
  }
  assert.deepEqual(
    [...pages.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, page]) => ({ ...page, ids: page.ids.sort() })),
    PAGES,
  );
});

test("every design folder holds at most five of its own screens", async () => {
  const { manifest } = await designCatalogue;
  const folders = new Map<string, string[]>();
  for (const entry of manifest.entries) {
    if (
      entry.kind !== "screen" ||
      !entry.id.startsWith("design-") ||
      entry.variantOf !== undefined
    )
      continue;
    const key = entry.navPath.join(" › ");
    folders.set(key, [...(folders.get(key) ?? []), entry.id]);
  }
  assert.ok(folders.size > 1);
  for (const [folder, ids] of folders)
    assert.ok(ids.length <= 5, `${folder} has ${ids.length}: ${ids.join()}`);
});
