/** Generated records and explicit index trees for navigation unit tests. */

import type {
  ShellCatalogueReadModel,
  ShellCatalogueRoutedEntry,
} from "../src/catalogue/scoped_types.js";
import type { CatalogueNode, EntryKind } from "../src/catalogue/types.js";
import { createCatalogue } from "../src/shell/catalogue.js";

import { rawIndexFixture } from "./catalogue_v9_fixture.js";
import {
  publishedComponent,
  publishedDocument,
  publishedPage,
  publishedScreen,
  publishedUseCase,
} from "./published_entries_fixture.js";

/** Complete generated entry data, without held detail usage. */
export function treeRecord(
  path: string,
  kind: EntryKind = "page",
  title = path,
  extra: { variantOf?: string; tags?: string[] } = {},
): ShellCatalogueRoutedEntry {
  const record =
    kind === "screen"
      ? publishedScreen(path, title)
      : kind === "component"
        ? publishedComponent(path, title)
        : kind === "document"
          ? publishedDocument(path, title)
          : kind === "use-case"
            ? publishedUseCase(path, title, [])
            : publishedPage(path, title);
  if (record.kind === "screen" || record.kind === "component")
    return {
      ...record,
      ...extra,
      views: record.views.map((view) => ({
        ...view,
        usage: { status: "omitted" },
      })),
    };
  return { ...record, ...extra };
}

export function entryNode(
  path: string,
  children?: CatalogueNode[],
  extra: { hidden?: true; order?: string[] } = {},
): CatalogueNode {
  return { kind: "entry", path, ...extra, ...(children ? { children } : {}) };
}

export function folderNode(
  path: string,
  title: string,
  children: CatalogueNode[],
  extra: { index?: string; hidden?: true; order?: string[] } = {},
): CatalogueNode {
  return { kind: "folder", path, title, children, ...extra };
}

/** Supply the index tree explicitly. This helper does not derive it from paths. */
export function treeModel(
  entries: readonly ShellCatalogueRoutedEntry[],
  tree: readonly CatalogueNode[],
  order?: readonly string[],
): ShellCatalogueReadModel {
  return {
    ...rawIndexFixture(),
    screens: entries.filter((entry) => entry.kind === "screen"),
    components: entries.filter((entry) => entry.kind === "component"),
    documents: entries.filter((entry) => entry.kind === "document"),
    pages: entries.filter((entry) => entry.kind === "page"),
    useCases: entries.filter((entry) => entry.kind === "use-case"),
    removedEntries: [],
    tree: [...tree],
    ...(order ? { treeOrder: [...order] } : {}),
    details: new Map(),
  };
}

export function treeHierarchy(
  entries: readonly ShellCatalogueRoutedEntry[],
  tree: readonly CatalogueNode[],
  order?: readonly string[],
) {
  return createCatalogue(treeModel(entries, tree, order)).hierarchy;
}
