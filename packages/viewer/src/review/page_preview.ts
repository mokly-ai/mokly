/** The removed page and document preview metadata v3 of a comparison generation. */

import {
  reviewCommit,
  reviewEntryPath,
  reviewInvalid,
  reviewObject,
  reviewString,
} from "./result_helpers.js";
import type { RemovedPagePreview } from "./types.js";

/** Strictly validate a removed page's identity-only preview payload. */
export function parseRemovedPagePreview(value: unknown): RemovedPagePreview {
  const input = reviewObject(value, [
    "schemaVersion",
    "baseRef",
    "baseCommit",
    "path",
  ]);
  if (input.schemaVersion !== 3) reviewInvalid("unsupported preview version");
  return {
    schemaVersion: 3,
    baseRef: reviewString(input.baseRef),
    baseCommit: reviewCommit(input.baseCommit),
    path: reviewEntryPath(input.path),
  };
}
