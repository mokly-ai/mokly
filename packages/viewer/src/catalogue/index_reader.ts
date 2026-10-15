/** The catalogue index v7 reader: the version gate first, then every field. */

import { invalidData, record } from "../components/data.js";

import { CHANGE_STATUSES, readEntry } from "./entry_reader.js";
import { assertPublicIndex } from "./privacy.js";
import { validateCatalogueReferences } from "./references.js";
import type {
  CatalogueNode,
  CatalogueReadModel,
  CatalogueRecord,
  RemovedEntry,
  RemovedEntryPreview,
} from "./types.js";
import {
  array,
  choice,
  comparisonPath,
  counter,
  entryPath,
  hash,
  object,
  string,
  text,
} from "./values.js";
import { MoklyVersionError } from "./version_error.js";

/** The only catalogue index number this viewer reads. */
const CATALOGUE_INDEX_VERSION = 7;

/** Gate the version, read every v7 field, and validate the relationships. */
export function readCatalogueIndex(value: unknown): CatalogueReadModel {
  const version = record(value) ? value.schemaVersion : undefined;
  if (version !== CATALOGUE_INDEX_VERSION)
    throw new MoklyVersionError("catalogue", version, CATALOGUE_INDEX_VERSION);
  const input = object(value);
  assertPublicIndex(input);
  const identity = object(input.identity);
  const comparisonUrl = comparisonPath(input.comparisonUrl);
  const treeOrder = readOrder(input.treeOrder);
  const entries = <Kind extends CatalogueRecord["kind"]>(
    field: string,
    kind: Kind,
  ) =>
    array(input[field]).map((raw) => {
      const entry = readEntry(raw);
      if (entry.kind !== kind)
        invalidData("$catalogue", "entry in wrong array");
      return entry as Extract<CatalogueRecord, { kind: Kind }>;
    });
  const model: CatalogueReadModel = {
    schemaVersion: CATALOGUE_INDEX_VERSION,
    identity: { id: hash(identity.id), title: text(identity.title) },
    deploymentId: hash(input.deploymentId),
    revision: counter(input.revision),
    ...(input.base === undefined ? {} : { base: string(input.base) }),
    ...(input.live === undefined ? {} : { live: readLive(input.live) }),
    changesStatus: choice(input.changesStatus, CHANGE_STATUSES),
    comparisonUrl,
    tree: array(input.tree).map(readNode),
    ...(treeOrder ? { treeOrder } : {}),
    screens: entries("screens", "screen"),
    pages: entries("pages", "page"),
    documents: entries("documents", "document"),
    useCases: entries("useCases", "use-case"),
    components: entries("components", "component"),
    removedEntries: array(input.removedEntries).map((raw) =>
      readRemovedEntry(raw, comparisonUrl),
    ),
  };
  validateCatalogueReferences(model);
  return model;
}

function readLive(value: unknown): { generation: string } {
  return { generation: hash(object(value).generation) };
}

function readRemovedEntry(
  raw: unknown,
  comparisonUrl: string | null,
): RemovedEntry {
  const removed = object(raw);
  const entry = readEntry(removed.entry);
  if (removed.snapshotId === undefined && comparisonUrl !== null)
    invalidData(
      "$catalogue",
      "removed entry needs snapshotId when comparisonUrl is non-null",
    );
  if (entry.previousPath !== undefined)
    invalidData("$catalogue", "removed entry cannot have previousPath");
  return {
    entry,
    folderTitles: array(removed.folderTitles).map(text),
    ...readParentTitle(removed, entry),
    ...(removed.snapshotId === undefined
      ? {}
      : { snapshotId: hash(removed.snapshotId) }),
    ...(removed.preview === undefined
      ? {}
      : { preview: readPreview(removed.preview) }),
  };
}

function readParentTitle(
  removed: Record<string, unknown>,
  entry: CatalogueRecord,
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
  const kind = choice(object(value).kind, [
    "screen",
    "page",
    "document",
  ] as const);
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
        path: entryPath(input.path),
        ...ordered,
        ...(input.children !== undefined
          ? { children: array(input.children).map(readNode) }
          : {}),
      }
    : {
        kind,
        ...hidden,
        path: entryPath(input.path),
        title: text(input.title),
        ...(input.index === undefined ? {} : { index: entryPath(input.index) }),
        ...ordered,
        children: array(input.children).map(readNode),
      };
}

/** Read an optional folder `order` of distinct child slugs and `...`. */
function readOrder(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  const order = array(value).map(text);
  if (
    new Set(order).size !== order.length ||
    order.some((name) => name.includes("/"))
  )
    invalidData("$catalogue", "order must name distinct child slugs");
  return order;
}
