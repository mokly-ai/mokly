import assert from "node:assert/strict";
import { test } from "node:test";

import { designCatalogue } from "./helpers/design_catalogue.js";

const DESIGN = "examples/basic/specs/design";
const STYLESHEETS = `${DESIGN}/changes/impact/styles`;
const GALLERY = "design/changes/impact/styles";

/** One page of the gallery: its folder, its own source module and screens. */
interface StylesheetPage {
  folderPath: string;
  sourcePath: string;
  ids: string[];
}

/**
 * The parent page keeps one canonical screen in its existing module. Each
 * child page has its own directory, named under the parent's path.
 */
const PAGES: StylesheetPage[] = [
  {
    folderPath: GALLERY,
    sourcePath: `${DESIGN}/review_style_screens.tsx`,
    ids: ["design/changes/impact/styles/page"],
  },
  {
    folderPath: `${GALLERY}/matched-excluded`,
    sourcePath: `${STYLESHEETS}/matched-excluded/screens.tsx`,
    ids: [
      "design/changes/impact/styles/matched-excluded/excluded",
      "design/changes/impact/styles/matched-excluded/excluded-only",
      "design/changes/impact/styles/matched-excluded/matched",
    ],
  },
  {
    folderPath: `${GALLERY}/unresolved-unnamed`,
    sourcePath: `${STYLESHEETS}/unresolved-unnamed/screens.tsx`,
    ids: [
      "design/changes/impact/styles/unresolved-unnamed/unnamed",
      "design/changes/impact/styles/unresolved-unnamed/unresolved",
    ],
  },
];

test("the stylesheet evidence page shows one canonical screen and links two child pages", async () => {
  const { manifest } = await designCatalogue;
  const pages = new Map<string, StylesheetPage>();
  for (const entry of manifest.entries) {
    if (entry.kind !== "screen" || !entry.path.startsWith(`${GALLERY}/`))
      continue;
    const key = entry.path.split("/").slice(0, -1).join("/");
    const page = pages.get(key) ?? {
      folderPath: key,
      sourcePath: entry.sourcePath,
      ids: [],
    };
    assert.equal(entry.sourcePath, page.sourcePath, entry.path);
    page.ids.push(entry.path);
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
      !entry.path.startsWith("design/") ||
      entry.variantOf !== undefined
    )
      continue;
    const key = entry.path.split("/").slice(0, -1).join("/");
    folders.set(key, [...(folders.get(key) ?? []), entry.path]);
  }
  assert.ok(folders.size > 1);
  for (const [folder, ids] of folders)
    assert.ok(ids.length <= 5, `${folder} has ${ids.length}: ${ids.join()}`);
});
