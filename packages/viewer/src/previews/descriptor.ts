/** Read the shell-rendered preview descriptor back out of one stage host. */

import { isHistoricalSnapshotId } from "../catalogue/snapshot_identity.js";
import type { RemovedEntryPreview } from "../catalogue/types.js";
import { isSafeCatalogueRoute } from "../data/paths.js";
import type { RemovedPreviewData } from "../shell/previews.js";

/** The attribute the shell writes on every previous-version stage host. */
export const PREVIEW_ATTRIBUTE = "data-mokly-preview";

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function published(value: unknown): RemovedEntryPreview | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as { kind?: unknown; path?: unknown };
  if (record.kind === "screen") return { kind: "screen" };
  const path = text(record.path);
  return record.kind === "page" && path ? { kind: "page", path } : undefined;
}

/**
 * Parse one host's descriptor. Anything unrecognized is treated as no
 * descriptor at all, so a damaged attribute shows the unavailable state rather
 * than requesting an address the catalogue never advertised.
 */
export function readPreviewDescriptor(
  raw: string | null,
): RemovedPreviewData | undefined {
  if (raw === null) return undefined;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const id = text(record["id"]);
  const route = text(record["route"]);
  const title = text(record["title"]);
  const kind = record["kind"];
  if (!id || !route || !title || !isSafeCatalogueRoute(route)) return undefined;
  if (kind !== "page" && kind !== "screen") return undefined;
  const address = text(record["address"]);
  const advertised = published(record["published"]);
  const catalogueIdentity = record["catalogueIdentity"];
  const snapshotId = record["snapshotId"];
  const hasIdentity =
    isHistoricalSnapshotId(catalogueIdentity) &&
    isHistoricalSnapshotId(snapshotId);
  if (
    (catalogueIdentity !== undefined || snapshotId !== undefined) &&
    !hasIdentity
  )
    return undefined;
  return {
    id,
    kind,
    route,
    title,
    ...(address ? { address } : {}),
    ...(hasIdentity ? { catalogueIdentity, snapshotId } : {}),
    ...(advertised ? { published: advertised } : {}),
  };
}

/** Identity of one requested preview; a different entry can never adopt it. */
export function previewKey(data: RemovedPreviewData): string {
  return JSON.stringify([
    data.id,
    data.kind,
    data.route,
    data.catalogueIdentity,
    data.snapshotId,
    data.published,
  ]);
}
