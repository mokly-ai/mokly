import { resolve } from "node:path";

import {
  VIEWER_DIRECTORY,
  currentDocumentPath,
  generatedResourcePath,
  isEntryPath,
  viewRoute,
} from "@mokly/viewer/data";

/** One generated viewport. */
export type Viewport = "mobile" | "desktop";

/** One generated color scheme. */
export type Scheme = "light" | "dark";

/**
 * Root of the authored catalogue, `docs/mockups`: the entries, screens,
 * fixtures, styles and these tests. Mokly writes no output here.
 */
export const catalogueRoot = resolve(import.meta.dirname, "../..");

/**
 * Root of the static catalogue that `npm run mockups:build` writes,
 * `mokly-static/` at the repository root. Every `*View` and `*Path` below is
 * relative to it.
 */
export const outputRoot = resolve(catalogueRoot, "../../mokly-static");

/**
 * The output-relative document that Mokly writes for one screen view,
 * `static/mokly-generated/<path>/index.<viewport>[.dark].html`. The path
 * comes from the entry path through the package's own route functions.
 */
export function screenView(
  id: string,
  viewport: Viewport,
  scheme: Scheme = "light",
): string {
  return currentDocumentPath(viewRoute(id, viewport, scheme));
}

/**
 * The output-relative document that Mokly writes for one view of a
 * component, its parent or a saved variant.
 */
export function componentView(
  id: string,
  viewport: Viewport,
  scheme: Scheme = "light",
): string {
  return currentDocumentPath(viewRoute(id, viewport, scheme));
}

/** The absolute path of one generated screen view. */
export function screenFile(
  id: string,
  viewport: Viewport,
  scheme: Scheme = "light",
): string {
  return resolve(outputRoot, screenView(id, viewport, scheme));
}

/** The absolute path of one generated component view. */
export function componentFile(
  id: string,
  viewport: Viewport,
  scheme: Scheme = "light",
): string {
  return resolve(outputRoot, componentView(id, viewport, scheme));
}

/*
 * The rules below have no public function. The pinned `@mokly/viewer` derives the
 * index and detail paths in its private `INDEX_PATH` and `entryDetailPath`,
 * but `@mokly/viewer/data` exports neither; `mokly-shell-delivery.md` documents
 * both routes. `mokly-imported-styles.md` and `mokly-artifact-paths.md`
 * document the stylesheet and authored-file routes, for which the package has
 * no function at all. Each rule is restated here once.
 */

/** The output directory of the documents, their resources and authored files. */
const staticDirectory = "static/";

/** The output-relative catalogue index, `mokly-viewer/index.json`. */
export const indexPath = `${VIEWER_DIRECTORY}/index.json`;

/** The output-relative detail of one current entry, `mokly-viewer/entries/<path>.json`. */
export function entryDetailPath(path: string): string {
  if (!isEntryPath(path)) throw new Error(`Not an entry path: ${path}`);
  return `${VIEWER_DIRECTORY}/entries/${path}.json`;
}

/**
 * The output-relative bundle of one configured stylesheet,
 * `static/mokly-generated/styles/<repository path>`, which each matching
 * document links.
 */
export function stylesheetPath(repositoryPath: string): string {
  return staticDirectory + generatedResourcePath("styles/" + repositoryPath);
}

/**
 * The output-relative copy of one authored repository file that a document
 * references, such as an image: `static/<repository path>`.
 */
export function repositoryFilePath(repositoryPath: string): string {
  return staticDirectory + repositoryPath;
}
