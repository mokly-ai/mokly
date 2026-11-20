/**
 * The built catalogue's public read model: the catalogue index and the entry
 * details that `npm run mockups:build` writes under `mokly-static/`, read
 * through the viewer's own readers. Each reader gates its version first,
 * index 9 and detail 4, and returns a copy of the producer data.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { readCatalogueIndex, readEntryDetail } from "@mokly/viewer";
import type {
  CatalogueNode,
  CatalogueReadModel,
  CatalogueRecord,
  ComponentInstanceRecord,
  ComponentRangeRecord,
  ComponentSlotRecord,
  EntryDetailV4,
} from "@mokly/viewer";

import { entryDetailPath, indexPath, outputRoot } from "./catalogue-paths";
import type { Scheme, Viewport } from "./catalogue-paths";

/** One rendered view of a screen or component and the usage it proves. */
export interface ViewUsage {
  viewport: Viewport;
  colorScheme: Scheme;
  instances: readonly ComponentInstanceRecord[];
  slots: readonly ComponentSlotRecord[];
  ranges: readonly ComponentRangeRecord[];
}

let index: CatalogueReadModel | undefined;
const details = new Map<string, EntryDetailV4>();

/** One output file, parsed but not yet validated. */
function readOutput(path: string): unknown {
  return JSON.parse(readFileSync(resolve(outputRoot, path), "utf8"));
}

/** Freeze a parsed value at every depth, so no test changes what another reads. */
function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/**
 * The catalogue index of the build output, read once per process. The value
 * is frozen; copy it with `structuredClone` before a test changes it.
 */
export function catalogueIndex(): CatalogueReadModel {
  index ??= deepFreeze(readCatalogueIndex(readOutput(indexPath)));
  return index;
}

/** The frozen detail of one current entry, read once per process. */
export function entryDetail(path: string): EntryDetailV4 {
  const cached = details.get(path);
  if (cached) return cached;
  const detail = deepFreeze(readEntryDetail(readOutput(entryDetailPath(path))));
  details.set(path, detail);
  return detail;
}

/**
 * Every current entry record in the index's canonical order: components,
 * documents, pages, screens, then use cases, each by path, with a parent's
 * variants directly after it.
 */
export function catalogueEntries(
  model: CatalogueReadModel = catalogueIndex(),
): CatalogueRecord[] {
  return [
    ...model.components,
    ...model.documents,
    ...model.pages,
    ...model.screens,
    ...model.useCases,
  ];
}

/**
 * Each view of one current screen or component, with the registered
 * component instances, slots and regions that it draws, from the entry's
 * detail. A build renders every view before it writes its details, so each
 * view's usage must be ready. Pages, documents and use cases have no view.
 */
export function viewUsage(path: string): ViewUsage[] {
  return entryDetail(path).views.map(({ colorScheme, usage, viewport }) => {
    assert.ok(
      usage.status === "ready",
      `${path} ${viewport} ${colorScheme}: usage is ${usage.status}`,
    );
    const { instances, ranges, slots } = usage;
    return { viewport, colorScheme, instances, slots, ranges };
  });
}

/**
 * The breadcrumb titles above one current entry, outermost first, as the
 * viewer derives them from the index tree: a variant takes its parent's
 * crumbs, and each folder above shows its folder node's title, or the title
 * of the screen or component that is the folder's own page. Pass a changed
 * copy of the index to check a rejection.
 */
export function ancestorTitles(
  path: string,
  model: CatalogueReadModel = catalogueIndex(),
): string[] {
  const records = new Map(
    catalogueEntries(model).map((record) => [record.path, record]),
  );
  const folders = new Map<string, string>();
  const visit = (nodes: readonly CatalogueNode[]): void => {
    for (const node of nodes) {
      if (node.kind === "folder") folders.set(node.path, node.title);
      visit(node.children ?? []);
    }
  };
  visit(model.tree);
  const record = records.get(path);
  assert.ok(record, `Missing mockup entry ${path}`);
  const owner =
    record.kind === "screen" || record.kind === "component"
      ? (record.variantOf ?? path)
      : path;
  const segments = owner.split("/").slice(0, -1);
  return segments.map((_, depth) => {
    const folder = segments.slice(0, depth + 1).join("/");
    const title = folders.get(folder) ?? records.get(folder)?.title;
    assert.ok(title !== undefined, `No folder or entry at ${folder}`);
    return title;
  });
}
