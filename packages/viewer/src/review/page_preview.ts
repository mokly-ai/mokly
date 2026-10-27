/** The removed page and document preview metadata v3 of a comparison generation. */

import { commitId, entryPath, string } from "../catalogue/values.js";
import { invalidData, record } from "../components/data.js";

import type { RemovedPagePreview } from "./types.js";

const FIELDS = ["schemaVersion", "baseRef", "baseCommit", "path"];

/** Strictly validate a removed page's identity-only preview payload. */
export function parseRemovedPagePreview(value: unknown): RemovedPagePreview {
  if (
    !record(value) ||
    Object.keys(value).length !== FIELDS.length ||
    FIELDS.some((field) => !Object.hasOwn(value, field))
  )
    invalidData("$preview", "expected exactly the preview metadata fields");
  if (value.schemaVersion !== 3)
    invalidData("$preview", "unsupported preview version");
  return {
    schemaVersion: 3,
    baseRef: string(value.baseRef),
    baseCommit: commitId(value.baseCommit),
    path: entryPath(value.path),
  };
}
