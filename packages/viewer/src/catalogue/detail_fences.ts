/** The fences that bind one entry detail to the installed catalogue index. */

import { canonicalJson } from "../components/data.js";
import type { PropSchema } from "../components/prop_types.js";
import { validateComponentViewRecord } from "../components/view_validation.js";

import type {
  CatalogueReadModel,
  CatalogueRecord,
  EntryDetailV3,
} from "./types.js";

/** One requested detail: a current path, or a removed record's identity. */
export interface DetailRequest {
  path: string;
  snapshotId?: string;
}

/** The outcome of comparing one validated detail with the installed index. */
export type DetailFence =
  | { kind: "accepted"; detail: EntryDetailV3 }
  | { kind: "revision"; detail: EntryDetailV3 }
  | { kind: "deployment" }
  | { kind: "rejected" };

/** The stable key of one requested detail. */
export function detailKey(request: DetailRequest): string {
  return request.snapshotId === undefined
    ? `current:${request.path}`
    : `removed:${request.snapshotId}:${request.path}`;
}

/**
 * Accept a current entry's detail when revision, detail id, identity and
 * content match the index. A revision mismatch is reported before the content
 * is compared, so the content is matched against its own revision's index.
 */
export function fenceDetail(
  index: CatalogueReadModel,
  request: DetailRequest,
  detail: EntryDetailV3,
): DetailFence {
  if (request.snapshotId === undefined) {
    if (detail.revision !== index.revision) return { kind: "revision", detail };
    const entry = currentEntry(index, request.path);
    if (!entry) return { kind: "rejected" };
    if (detail.detailId !== entry.detailId) return { kind: "deployment" };
    if (canonicalJson(detail.identity) !== canonicalJson(index.identity))
      return { kind: "rejected" };
    return entry && matches(index, entry, detail, false)
      ? { kind: "accepted", detail }
      : { kind: "rejected" };
  }
  if (canonicalJson(detail.identity) !== canonicalJson(index.identity))
    return { kind: "rejected" };
  const record = index.removedEntries.find(
    (candidate) =>
      candidate.entry.path === request.path &&
      candidate.snapshotId === request.snapshotId,
  );
  if (
    !record ||
    detail.entry.snapshotId !== request.snapshotId ||
    detail.detailId !== record.entry.detailId ||
    !matches(index, record.entry, detail, true)
  )
    return { kind: "rejected" };
  return { kind: "accepted", detail };
}

/** The current entry a path names in the installed index. */
export function currentEntry(
  index: CatalogueReadModel,
  path: string,
): CatalogueRecord | undefined {
  return [
    ...index.screens,
    ...index.components,
    ...index.pages,
    ...index.documents,
    ...index.useCases,
  ].find((entry) => entry.path === path);
}

function matches(
  index: CatalogueReadModel,
  entry: CatalogueRecord,
  detail: EntryDetailV3,
  historical: boolean,
): boolean {
  if (detail.entry.path !== entry.path || detail.entry.kind !== entry.kind)
    return false;
  if (entry.kind !== "screen" && entry.kind !== "component")
    return detail.views.length === 0;
  if (
    !detail.controlOrder ||
    detail.controlOrder.length !== Object.keys(entry.controls).length ||
    new Set(detail.controlOrder).size !== detail.controlOrder.length ||
    detail.controlOrder.some((key) => !Object.hasOwn(entry.controls, key))
  )
    return false;
  const axes = (views: readonly { viewport: string; colorScheme: string }[]) =>
    canonicalJson(views.map((view) => [view.viewport, view.colorScheme]));
  if (axes(detail.views) !== axes(entry.views)) return false;
  const components = indexComponents(index);
  const rootId =
    entry.kind === "component" ? (entry.variantOf ?? entry.path) : undefined;
  try {
    for (const view of detail.views)
      if (view.usage.status === "ready")
        validateComponentViewRecord(
          {
            viewport: view.viewport,
            colorScheme: view.colorScheme,
            instances: view.usage.instances,
            slots: view.usage.slots,
            ranges: view.usage.ranges,
            styles: [],
            resources: [],
          },
          components,
          `${entry.path} / ${view.viewport}/${view.colorScheme}`,
          rootId,
          historical,
        );
  } catch {
    return false;
  }
  return true;
}

function indexComponents(
  index: CatalogueReadModel,
): ReadonlyMap<string, { propSchema: PropSchema; slots: readonly string[] }> {
  const parents = [
    ...index.components,
    ...index.removedEntries.map(({ entry }) => entry),
  ].flatMap((entry) =>
    entry.kind === "component" && entry.variantOf === undefined
      ? [[entry.path, entry] as const]
      : [],
  );
  return new Map(parents);
}
