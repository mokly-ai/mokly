import { exactKeys, invalidData } from "../components/data.js";

import { CHANGE_STATUSES, readEntry, readShellEntry } from "./entry_reader.js";
import { readCurrentPath } from "./path_values.js";
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
  CatalogueRecord,
  RemovedEntryPreview,
} from "./types.js";
import {
  array,
  choice,
  comparisonPath,
  counter,
  hash,
  object,
  text,
} from "./values.js";

/** Parse known v4 fields; ignore compatible additions without exposing private data. */
export function readCatalogue<Input>(value: Input): CatalogueReadModel {
  const model = readCatalogueModel(value, readEntry);
  validateCatalogueReferences(model);
  return model as unknown as CatalogueReadModel;
}

/** Parse the shell-only usage union before its route scope is enforced. */
export function readShellCatalogue(value: unknown): ShellCatalogueReadModel {
  const model = readCatalogueModel(value, readShellEntry);
  validateCatalogueReferences(model);
  return model as unknown as ShellCatalogueReadModel;
}

type ParsedRoutedEntry =
  CatalogueRecord<string> | ShellCatalogueRoutedEntry<string>;
type ParsedCatalogue<Entry extends ParsedRoutedEntry> = Omit<
  CatalogueReadModel<string, string>,
  | "screens"
  | "pages"
  | "documents"
  | "useCases"
  | "components"
  | "removedEntries"
> & {
  documents: readonly Extract<Entry, { kind: "document" }>[];
  screens: readonly Extract<Entry, { kind: "screen" }>[];
  pages: readonly Extract<Entry, { kind: "page" }>[];
  useCases: readonly Extract<Entry, { kind: "use-case" }>[];
  components: readonly Extract<Entry, { kind: "component" }>[];
  removedEntries: readonly {
    entry: Entry;
    folderTitles: readonly string[];
    parentTitle?: string;
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
    invalidData("$catalogue", "unsupported schemaVersion");
  assertPublicCatalogue(input);
  const identity = object(input.identity),
    revision = object(input.revision);
  const catalogueIdentity = hash(identity.id);
  const comparisonUrl = comparisonPath(input.comparisonUrl);
  const generation = comparisonGeneration(comparisonUrl);
  const treeOrder = readOrder(input.treeOrder);
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
    tree: array(input.tree).map(readNode),
    ...(treeOrder ? { treeOrder } : {}),
    documents: entries("documents", "document"),
    screens: entries("screens", "screen"),
    pages: entries("pages", "page"),
    useCases: entries("useCases", "use-case"),
    components: entries("components", "component"),
    removedEntries: array(input.removedEntries).map((raw) => {
      const removed = object(raw);
      const entry = readRoutedEntry(removed.entry);
      if (entry.previousPath !== undefined)
        invalidData("$catalogue", "removed entry cannot have previousPath");
      const snapshotId =
        removed.snapshotId === undefined
          ? generation
            ? historicalSnapshotId(
                catalogueIdentity,
                { kind: "generation", identity: generation },
                entry,
              )
            : undefined
          : hash(removed.snapshotId);
      return {
        entry,
        folderTitles: array(removed.folderTitles).map(text),
        ...readParentTitle(removed, entry),
        ...(snapshotId ? { snapshotId } : {}),
        ...(removed.preview === undefined
          ? {}
          : { preview: readPreview(removed.preview) }),
      };
    }),
  };
}

function readParentTitle(
  removed: Record<string, unknown>,
  entry: ParsedRoutedEntry,
): { parentTitle?: string } {
  if ("variantOf" in entry && entry.variantOf !== undefined) {
    if (typeof removed.parentTitle !== "string" || !removed.parentTitle.trim())
      invalidData(
        "$catalogue",
        "removed variant requires nonempty parentTitle",
      );
    return { parentTitle: removed.parentTitle };
  }
  if (Object.hasOwn(removed, "parentTitle"))
    invalidData("$catalogue", "parentTitle is only valid on a removed variant");
  return {};
}

function readPreview(value: unknown): RemovedEntryPreview {
  const input = object(value),
    kind = choice(input.kind, ["screen", "page", "document"] as const);
  exactKeys(input, ["kind"], "$catalogue.preview");
  return { kind };
}

function readNode(value: unknown): CatalogueNode {
  const input = object(value),
    kind = choice(input.kind, ["folder", "entry"] as const);
  if (input.hidden !== undefined && input.hidden !== true)
    invalidData("$catalogue", "hidden must be true when present");
  const hidden = input.hidden ? { hidden: true as const } : {};
  const order = readOrder(input.order);
  const ordered = order ? { order } : {};
  return kind === "entry"
    ? {
        kind,
        ...hidden,
        path: readCurrentPath(input.path),
        ...ordered,
        ...(input.children !== undefined
          ? { children: array(input.children).map(readNode) }
          : {}),
      }
    : {
        kind,
        ...hidden,
        path: readCurrentPath(input.path),
        title: text(input.title),
        ...(input.index === undefined
          ? {}
          : { index: readCurrentPath(input.index) }),
        ...ordered,
        children: array(input.children).map(readNode),
      };
}

/** Read an optional folder `order` of distinct child slugs and `...`. */
function readOrder(value: unknown): readonly string[] | undefined {
  if (value === undefined) return undefined;
  const order = array(value).map(text);
  if (
    new Set(order).size !== order.length ||
    order.some((name) => name.includes("/"))
  )
    invalidData("$catalogue", "order must name distinct child slugs");
  return order;
}
