/** Identify one route-owned preview request. */

import type { RemovedPreviewData } from "../shell/previews.js";

/** Identity of one requested preview; a different entry can never adopt it. */
export function previewKey(data: RemovedPreviewData): string {
  return JSON.stringify([
    data.path,
    data.kind,
    data.catalogueIdentity,
    data.snapshotId,
    data.published,
    data.colorSchemes,
  ]);
}
