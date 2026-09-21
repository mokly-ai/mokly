import {
  reviewInvalid,
  reviewObject,
  reviewPath,
  reviewRoute,
  reviewString,
} from "./result_helpers.js";
import type { ReviewArtifactContent } from "./types.js";

/** Typed metadata for one removed page captured from a pinned baseline. */
export interface RemovedPagePreview {
  schemaVersion: 1;
  baseRef: string;
  baseCommit: string;
  route: string;
  documentPath: string;
}

/** Historical page bytes and the metadata serialized beside them. */
export interface RemovedPagePreviewArtifact {
  files: ReadonlyMap<string, ReviewArtifactContent>;
  preview: RemovedPagePreview;
}

/** Strictly validate a removed page's `preview.json` payload. */
export function parseRemovedPagePreview(value: unknown): RemovedPagePreview {
  const input = reviewObject(value, [
    "schemaVersion",
    "baseRef",
    "baseCommit",
    "route",
    "documentPath",
  ]);
  if (input.schemaVersion !== 1) reviewInvalid("unsupported preview version");
  const baseCommit = reviewString(input.baseCommit);
  if (!/^[a-f0-9]{40,64}$/.test(baseCommit))
    reviewInvalid("invalid base commit");
  const baseRef = reviewString(input.baseRef);
  const route = reviewRoute(input.route);
  const documentPath = reviewPath(input.documentPath);
  if (documentPath !== `snapshots/before/${route}`)
    reviewInvalid("preview document does not match its route");
  return { schemaVersion: 1, baseRef, baseCommit, route, documentPath };
}
