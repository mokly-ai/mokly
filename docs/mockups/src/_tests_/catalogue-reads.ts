/**
 * What the selection policies read of the build output beside the index
 * records: the entry module that owns each entry, and the palette that the
 * renderer's wrapper gives each rendered document. The renderer chooses the
 * palette from the entry's kind and path, so the documents are its proof.
 */

import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import { documentPalettes } from "@mokly-cloud/tokens/palettes";
import type { DocumentPalette } from "@mokly-cloud/tokens/palettes";
import { parseFragment } from "parse5";

import type { CatalogueRecord } from "@mokly/viewer";

import { catalogueEntries } from "./catalogue-index";
import { catalogueRoot, screenFile } from "./catalogue-paths";
import type { Scheme, Viewport } from "./catalogue-paths";
import {
  attribute,
  elements,
  repositoryRoot,
} from "./design-site-test-helpers";

/** The repository path of one authored file below `docs/mockups`. */
export function authoredPath(path: string): string {
  return relative(repositoryRoot, resolve(catalogueRoot, path));
}

/** The repository-relative directory of the entry modules. */
const entriesDirectory = authoredPath("src/entries");

/**
 * The module that owns one entry, relative to `src/entries`, as the index
 * records it: a variant's module is its parent's.
 */
export function entryModule(record: CatalogueRecord): string {
  return relative(entriesDirectory, record.details.sourcePath);
}

/** The palette that one rendered view's wrapper carries, from its scope class. */
export function viewPalette(
  path: string,
  viewport: Viewport,
  scheme: Scheme,
): DocumentPalette {
  const html = readFileSync(screenFile(path, viewport, scheme), "utf8");
  const open = html.indexOf("<", html.indexOf(">", html.indexOf("<body")) + 1);
  const [wrapper] = elements(
    parseFragment(html.slice(open, html.indexOf(">", open) + 1)),
    (element) =>
      attribute(element, "data-color-scheme") === scheme &&
      attribute(element, "data-viewport") === viewport,
  );
  if (wrapper === undefined)
    throw new Error(`${path} ${viewport} ${scheme}: no renderer wrapper`);
  const classes = (attribute(wrapper, "class") ?? "").split(/\s+/);
  if (classes.includes(documentPalettes.canvas.scope)) return "canvas";
  if (classes.includes(documentPalettes.folio.scope)) return "folio";
  if (classes.includes(documentPalettes.paper.scope)) return "paper";
  return "default";
}

const palettes = new Map<string, DocumentPalette | undefined>();

/**
 * The one palette that every rendered view of one current screen or
 * component carries, or nothing when its views differ or it has none. Each
 * entry's documents are read once per process.
 */
export function drawnPalette(path: string): DocumentPalette | undefined {
  if (palettes.has(path)) return palettes.get(path);
  const record = catalogueEntries().find((entry) => entry.path === path);
  const views =
    record?.kind === "screen" || record?.kind === "component"
      ? record.views
      : [];
  const drawn = new Set(
    views.map((view) => viewPalette(path, view.viewport, view.colorScheme)),
  );
  const [palette] = drawn;
  palettes.set(path, drawn.size === 1 ? palette : undefined);
  return palettes.get(path);
}
