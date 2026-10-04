import { exactKeys, invalidData } from "../components/data.js";

import { CHANGE_STATUSES, readEntry, readShellEntry } from "./entry_reader.js";
import { assertPublicCatalogue } from "./privacy.js";
import { validateCatalogueReferences } from "./references.js";
import type {
  ShellCatalogueReadModel,
  ShellCatalogueRoutedEntry,
} from "./scoped_types.js";
import type {
  CatalogueNode,
  CatalogueReadModel,
  CatalogueRecord,
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
  text,
} from "./values.js";
import { MoklyVersionError } from "./version_error.js";

/** Parse known v4 fields; ignore compatible additions without exposing private data. */
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

type ParsedRoutedEntry = CatalogueRecord | ShellCatalogueRoutedEntry;
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
    snapshotId?: string;
    preview?: RemovedEntryPreview;
  }[];
};

function readCatalogueModel<Entry extends ParsedRoutedEntry>(
  value: unknown,
  readRoutedEntry: (value: unknown) => Entry,
): ParsedCatalogue<Entry> {
  const input = object(value);
  if (input.schemaVersion !== 4)
    throw new MoklyVersionError("catalogue", input.schemaVersion, 4);
  assertPublicCatalogue(input);
  const identity = object(input.identity),
    revision = object(input.revision),
    tree = object(input.tree);
  const catalogueIdentity = hash(identity.id);
  const comparisonUrl = comparisonPath(input.comparisonUrl);
  const entries = <Kind extends Entry["kind"]>(field: string, kind: Kind) =>
    array(input[field]).map((raw) => {
      const entry = readRoutedEntry(raw);
      if (entry.kind !== kind)
        invalidData("$catalogue", "entry in wrong array");
      return entry as Extract<Entry, { kind: Kind }>;
    });
  return {
    schemaVersion: 4,
    identity: { id: catalogueIdentity, title: text(identity.title) },
    deploymentId: hash(input.deploymentId),
    revision: {
      content: counter(revision.content),
      evidence: counter(revision.evidence),
    },
    changesStatus: choice(input.changesStatus, CHANGE_STATUSES),
    comparisonUrl,
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
      if (removed.snapshotId === undefined && comparisonUrl !== null)
        invalidData(
          "$catalogue",
          "removed entry needs snapshotId when a comparison generation exists",
        );
      const snapshotId =
        removed.snapshotId === undefined ? undefined : hash(removed.snapshotId);
      return {
        entry,
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
  exactKeys(input, ["kind"], "$catalogue.preview");
  return { kind };
}

function readNode(value: unknown): CatalogueNode {
  const input = object(value),
    kind = choice(input.kind, ["folder", "entry"] as const);
  return kind === "entry"
    ? {
        kind,
        id: id(input.id),
        ...(input.children !== undefined
          ? { children: array(input.children).map(readNode) }
          : {}),
      }
    : {
        kind,
        label: text(input.label),
        children: array(input.children).map(readNode),
      };
}
