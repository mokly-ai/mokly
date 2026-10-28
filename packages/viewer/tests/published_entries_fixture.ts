/** Published catalogues of plain entries, built through the index reader. */

import { createHash } from "node:crypto";

import { readCatalogueIndex } from "../src/catalogue/index_reader.js";
import type { ShellCatalogueReadModel } from "../src/catalogue/scoped_types.js";
import { shellCatalogueModel } from "../src/catalogue/shell_model.js";
import type {
  CatalogueComponent,
  CatalogueDocument,
  CatalogueNode,
  CataloguePage,
  CatalogueRecord,
  CatalogueScreen,
  CatalogueUseCase,
  RemovedEntry,
} from "../src/catalogue/types.js";
import type { Catalogue } from "../src/shell/catalogue.js";
import { viewerCatalogue } from "../src/viewer/projection.js";

import { rawIndexFixture } from "./catalogue_v8_fixture.js";

/** The Changes state of one published entry. */
export type ScreenChange = "changed" | "removed" | "unmodified";

/** A stable 64-digit hash for a test identity. */
function hash(seed: string): string {
  return createHash("sha256").update(seed).digest("hex");
}

/** Ready Changes, which include a changed or removed entry. */
function readyChanges(change: ScreenChange) {
  return {
    included: change !== "unmodified",
    kind: change,
    status: "ready" as const,
  };
}

/** The authored details of one entry, with no related documents. */
function entryDetails(title: string, sourcePath: string) {
  return { description: title, relatedDocs: [] as string[], sourcePath };
}

/** A light mobile and desktop view; only a changed one offers a comparison. */
function lightViews(path: string, change: ScreenChange) {
  return (["mobile", "desktop"] as const).map((viewport) => ({
    colorScheme: "light" as const,
    comparison: {
      eligible: change === "changed",
      kind: change,
      status: "ready" as const,
    },
    documentKey: hash(`${path}:${viewport}`),
    viewport,
  }));
}

/**
 * One screen record with a light mobile and desktop view. Changes includes a
 * changed or removed screen, and only a changed one offers a comparison.
 */
export function publishedScreen(
  path: string,
  title: string,
  change: ScreenChange = "unmodified",
  variantOf?: string,
): CatalogueScreen {
  return {
    changes: readyChanges(change),
    colorSchemes: ["light"],
    controls: {},
    details: entryDetails(title, `specs/${path}.mockup.tsx`),
    kind: "screen",
    path,
    propSchema: { additionalProperties: false, type: "object" },
    props: {},
    tags: [],
    title,
    useCasePaths: [],
    ...(variantOf ? { variantOf } : {}),
    views: lightViews(path, change),
  };
}

/** One Markdown document record with a light render. */
export function publishedDocument(
  path: string,
  title: string,
  change: ScreenChange = "unmodified",
): CatalogueDocument {
  return {
    changes: readyChanges(change),
    colorSchemes: ["light"],
    details: entryDetails(title, `specs/${path}.md`),
    documentKeys: [
      { colorScheme: "light", documentKey: hash(`${path}:light`) },
    ],
    kind: "document",
    path,
    tags: [],
    title,
  };
}

/** One whole-document page record. */
export function publishedPage(
  path: string,
  title: string,
  change: ScreenChange = "unmodified",
): CataloguePage {
  return {
    changes: readyChanges(change),
    details: entryDetails(title, `specs/${path}.mockup.tsx`),
    documentKey: hash(path),
    kind: "page",
    path,
    tags: [],
    title,
  };
}

/**
 * One use case whose steps show these screens in order. Each step screen
 * must list the use case in its `useCasePaths`.
 */
export function publishedUseCase(
  path: string,
  title: string,
  steps: readonly string[],
): CatalogueUseCase {
  return {
    changes: readyChanges("unmodified"),
    details: entryDetails(title, `specs/${path}.mockup.tsx`),
    kind: "use-case",
    path,
    steps: steps.map((screenPath) => ({ screenPath })),
    tags: [],
    title,
  };
}

/** One component parent without props, slots, or variants. */
export function publishedComponent(
  path: string,
  title: string,
  change: ScreenChange = "unmodified",
): CatalogueComponent {
  return {
    changes: readyChanges(change),
    colorSchemes: ["light"],
    comparison: {
      eligible: change === "changed" || change === "removed",
      kind: change,
      status: "ready",
    },
    controls: {},
    details: entryDetails(title, `specs/${path}.mockup.tsx`),
    kind: "component",
    path,
    propSchema: { additionalProperties: false, properties: {}, type: "object" },
    props: {},
    slots: [],
    suppliedSlots: [],
    tags: [],
    title,
    views: lightViews(path, change),
  };
}

/** A current entry that moved from `previousPath`; Changes lists each move. */
export function movedEntry<T extends CatalogueRecord>(
  record: T,
  previousPath: string,
): T {
  const changed =
    record.changes.status === "ready" && record.changes.kind === "changed";
  return {
    ...record,
    changes: {
      included: true,
      kind: changed ? "changed" : "unmodified",
      status: "ready",
    },
    previousPath,
  };
}

/**
 * A removed entry from a record with removed Changes, its base folder titles,
 * and, for a variant, its parent's title.
 */
export function removedEntry(
  record: CatalogueRecord,
  folderTitles: readonly string[],
  parentTitle?: string,
): RemovedEntry {
  return {
    entry: record,
    folderTitles: [...folderTitles],
    ...(parentTitle === undefined ? {} : { parentTitle }),
    ...(record.kind === "screen" ||
    record.kind === "page" ||
    record.kind === "document"
      ? { preview: { kind: record.kind } }
      : {}),
    snapshotId: hash(`removed:${record.path}`),
  };
}

/** A removed screen variant with its base folder titles and parent title. */
export function removedScreenVariant(
  path: string,
  title: string,
  parent: { path: string; title: string },
  folderTitles: readonly string[],
): RemovedEntry {
  return removedEntry(
    publishedScreen(path, title, "removed", parent.path),
    folderTitles,
    parent.title,
  );
}

/** The entries, removed entries, and tree of one published index. */
export interface PublishedEntries {
  components?: readonly CatalogueComponent[];
  documents?: readonly CatalogueDocument[];
  pages?: readonly CataloguePage[];
  removedEntries?: readonly RemovedEntry[];
  screens?: readonly CatalogueScreen[];
  tree: readonly CatalogueNode[];
  useCases?: readonly CatalogueUseCase[];
}

/**
 * The validated shell model of one index that holds only these entries,
 * removed entries, and tree, with Changes ready and no held details.
 */
export function publishedModel(
  input: PublishedEntries,
): ShellCatalogueReadModel {
  const raw = rawIndexFixture();
  raw.components = [...(input.components ?? [])];
  raw.documents = [...(input.documents ?? [])];
  raw.pages = [...(input.pages ?? [])];
  raw.screens = [...(input.screens ?? [])];
  raw.useCases = [...(input.useCases ?? [])];
  raw.removedEntries = [...(input.removedEntries ?? [])];
  raw.tree = [...input.tree];
  return shellCatalogueModel(readCatalogueIndex(raw), new Map());
}

/** The shell catalogue that a delivery builds from those published entries. */
export function publishedCatalogue(input: PublishedEntries): Catalogue {
  return viewerCatalogue(publishedModel(input));
}
