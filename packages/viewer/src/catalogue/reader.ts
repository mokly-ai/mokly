import { exactKeys, invalidData } from "../components/data.js";

import {
  CHANGE_STATUSES,
  readCollection,
  readEntry,
  readShellEntry,
} from "./entry_reader.js";
import { assertPublicCatalogue } from "./privacy.js";
import { validateCatalogueReferences } from "./references.js";
import type {
  ShellCatalogueReadModel,
  ShellCatalogueRoutedEntry,
} from "./scoped_types.js";
import {
  comparisonGeneration,
  historicalSnapshotId,
} from "./snapshot_identity.js";
import type {
  CatalogueNode,
  CatalogueReadModel,
  CatalogueRoutedEntry,
  RemovedEntryPreview,
} from "./types.js";
import {
  array,
  choice,
  comparisonPath,
  counter,
  hash,
  id,
  object,
  pagePreviewPath,
  text,
} from "./values.js";

/** Parse known v1 fields; ignore compatible additions without exposing private data. */
export function readCatalogue(value: unknown): CatalogueReadModel {
  const model = readCatalogueModel(value, readEntry);
  validateCatalogueReferences(model);
  return model;
}

/** Parse the shell-only usage union before its route scope is enforced. */
export function readShellCatalogue(value: unknown): ShellCatalogueReadModel {
  const model = readCatalogueModel(value, readShellEntry);
  validateCatalogueReferences(model);
  return model;
}

type ParsedRoutedEntry = CatalogueRoutedEntry | ShellCatalogueRoutedEntry;
type ParsedCatalogue<Entry extends ParsedRoutedEntry> = Omit<
  CatalogueReadModel,
  "screens" | "pages" | "useCases" | "components" | "removedEntries"
> & {
  screens: readonly Extract<Entry, { kind: "screen" }>[];
  pages: readonly Extract<Entry, { kind: "page" }>[];
  useCases: readonly Extract<Entry, { kind: "use-case" }>[];
  components: readonly Extract<Entry, { kind: "component" }>[];
  removedEntries: readonly {
    entry: Entry;
    ancestors: readonly { id: string; title: string }[];
    snapshotId?: string;
    preview?: RemovedEntryPreview;
  }[];
};

function readCatalogueModel<Entry extends ParsedRoutedEntry>(
  value: unknown,
  readRoutedEntry: (value: unknown) => Entry,
): ParsedCatalogue<Entry> {
  const input = object(value);
  if (input.schemaVersion !== 1)
    invalidData("$catalogue", "unsupported schemaVersion");
  assertPublicCatalogue(input);
  const identity = object(input.identity),
    revision = object(input.revision),
    tree = object(input.tree);
  const catalogueIdentity = hash(identity.id);
  const comparisonUrl = comparisonPath(input.comparisonUrl);
  const legacyGeneration = comparisonGeneration(comparisonUrl);
  const entries = <Kind extends Entry["kind"]>(field: string, kind: Kind) =>
    array(input[field]).map((raw) => {
      const entry = readRoutedEntry(raw);
      if (entry.kind !== kind)
        invalidData("$catalogue", "entry in wrong array");
      return entry as Extract<Entry, { kind: Kind }>;
    });
  return {
    schemaVersion: 1,
    identity: { id: catalogueIdentity, title: text(identity.title) },
    deploymentId: hash(input.deploymentId),
    revision: {
      content: counter(revision.content),
      evidence: counter(revision.evidence),
    },
    changesStatus: choice(input.changesStatus, CHANGE_STATUSES),
    comparisonUrl,
    collections: array(input.collections).map(readCollection),
    tree: {
      pages: array(tree.pages).map(readNode),
      components: array(tree.components).map(readNode),
    },
    screens: entries("screens", "screen"),
    pages: entries("pages", "page"),
    useCases: entries("useCases", "use-case"),
    components: entries("components", "component"),
    removedEntries: array(input.removedEntries).map((raw) => {
      const removed = object(raw);
      const entry = readRoutedEntry(removed.entry);
      const snapshotId =
        removed.snapshotId === undefined
          ? legacyGeneration
            ? historicalSnapshotId(
                catalogueIdentity,
                { kind: "generation", identity: legacyGeneration },
                entry,
              )
            : undefined
          : hash(removed.snapshotId);
      return {
        entry,
        ancestors: array(removed.ancestors).map((raw) => {
          const ancestor = object(raw);
          return { id: id(ancestor.id), title: text(ancestor.title) };
        }),
        ...(snapshotId ? { snapshotId } : {}),
        ...(removed.preview === undefined
          ? {}
          : { preview: readPreview(removed.preview) }),
      };
    }),
  };
}

function readPreview(value: unknown): RemovedEntryPreview {
  const input = object(value),
    kind = choice(input.kind, ["screen", "page"] as const);
  exactKeys(
    input,
    kind === "screen" ? ["kind"] : ["kind", "path"],
    "$catalogue.preview",
  );
  return kind === "screen"
    ? { kind }
    : { kind, path: pagePreviewPath(input.path) };
}

function readNode(value: unknown): CatalogueNode {
  const input = object(value),
    kind = choice(input.kind, ["collection", "entry"] as const);
  return kind === "entry"
    ? {
        kind,
        id: id(input.id),
        ...(input.children !== undefined
          ? { children: array(input.children).map(readNode) }
          : {}),
      }
    : { kind, id: id(input.id), children: array(input.children).map(readNode) };
}
