/** The removed page and document preview metadata v3 of a comparison generation. */

import { commitId, entryPath, string } from "../catalogue/values.js";
import { invalidData, record } from "../components/data.js";

import type { RemovedPagePreview } from "./types.js";

const FIELDS = ["schemaVersion", "baseRef", "baseCommit", "path"];

/**
 * Read a removed page's identity-only preview payload. It reads the fields of
 * this version and ignores any other field.
 */
export function parseRemovedPagePreview(value: unknown): RemovedPagePreview {
  if (!record(value) || FIELDS.some((field) => !Object.hasOwn(value, field)))
    invalidData("$preview", "expected the preview metadata fields");
  if (value.schemaVersion !== 3)
    invalidData("$preview", "unsupported preview version");
  return {
    schemaVersion: 3,
    baseRef: string(value.baseRef),
    baseCommit: commitId(value.baseCommit),
    path: entryPath(value.path),
  };
}
