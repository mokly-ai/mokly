/** The fences that bind one entry detail to the installed catalogue index. */

import type {
  CatalogueReadModel,
  CatalogueRecord,
  EntryDetailV4,
} from "@mokly/model";

/** One requested detail: a current path, or a removed record's identity. */
export interface DetailRequest {
  path: string;
  snapshotId?: string;
}

/**
 * The detail that carries a selected entry's workspace lists.
 * The caller marks current records. Current component variants use their
 * parent's detail. Historical entries keep their own detail, with or without
 * a snapshot identity.
 */
export function workspaceDetailRequest(
  entry: Pick<CatalogueRecord, "kind" | "path"> & { variantOf?: string },
  current: boolean,
  snapshotId?: string,
): DetailRequest {
  const path =
    current && entry.kind === "component" && entry.variantOf !== undefined
      ? entry.variantOf
      : entry.path;
  return {
    path,
    ...(snapshotId === undefined ? {} : { snapshotId }),
  };
}

/** The outcome of binding one detail to the installed index. */
export type DetailFence =
  | { kind: "accepted"; detail: EntryDetailV4 }
  | { kind: "revision"; detail: EntryDetailV4 }
  | { kind: "deployment" }
  | { kind: "rejected" };

/** The stable key of one requested detail. */
export function detailKey(request: DetailRequest): string {
  return request.snapshotId === undefined
    ? `current:${request.path}`
    : `removed:${request.snapshotId}:${request.path}`;
}

/**
 * Bind a detail by revision, detail id, and identity without checking content.
 * A revision mismatch runs first so a newer detail can refetch its own index.
 */
export function fenceDetail(
  index: CatalogueReadModel,
  request: DetailRequest,
  detail: EntryDetailV4,
): DetailFence {
  if (request.snapshotId === undefined) {
    if (detail.revision !== index.revision) return { kind: "revision", detail };
    const entry = currentEntry(index, request.path);
    if (!entry) return { kind: "rejected" };
    if (detail.detailId !== entry.detailId) return { kind: "deployment" };
    if (!sameIdentity(detail.identity, index.identity))
      return { kind: "rejected" };
    return matchesEntry(entry, detail)
      ? { kind: "accepted", detail }
      : { kind: "rejected" };
  }
  if (!sameIdentity(detail.identity, index.identity))
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
    !matchesEntry(record.entry, detail)
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

/** Compare only identity fields that this format defines. */
function sameIdentity(
  left: CatalogueReadModel["identity"],
  right: CatalogueReadModel["identity"],
): boolean {
  return left.id === right.id && left.title === right.title;
}

function matchesEntry(entry: CatalogueRecord, detail: EntryDetailV4): boolean {
  return detail.entry.path === entry.path && detail.entry.kind === entry.kind;
}
