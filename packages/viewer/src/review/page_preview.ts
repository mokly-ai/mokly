import { isEntryPath } from "../navigation/logical.js";

import { reviewInvalid, reviewObject, reviewString } from "./result_helpers.js";
import type { ReviewArtifactContent } from "./types.js";

/** Typed metadata for one removed page captured from a pinned baseline. */
export interface RemovedPagePreview {
  schemaVersion: 3;
  baseRef: string;
  baseCommit: string;
  path: string;
}

/** Historical page bytes and the metadata serialized beside them. */
export interface RemovedPagePreviewArtifact {
  files: ReadonlyMap<string, ReviewArtifactContent>;
  preview: RemovedPagePreview;
}

/** Strictly validate a removed page's identity-only preview payload. */
export function parseRemovedPagePreview(value: unknown): RemovedPagePreview {
  const input = reviewObject(value, [
    "schemaVersion",
    "baseRef",
    "baseCommit",
    "path",
  ]);
  if (input.schemaVersion !== 3) reviewInvalid("unsupported preview version");
  const baseCommit = reviewString(input.baseCommit);
  if (!/^[a-f0-9]{40,64}$/.test(baseCommit))
    reviewInvalid("invalid base commit");
  const baseRef = reviewString(input.baseRef);
  const path = reviewString(input.path);
  if (!isEntryPath(path)) reviewInvalid("invalid page path");
  return { schemaVersion: 3, baseRef, baseCommit, path };
}
