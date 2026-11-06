/** The removed page and document preview metadata v3 of a comparison generation. */

import type { RemovedPagePreview } from "@mokly/model";

import { invalidData, record } from "../components/data.js";

/** Copy a removed page's supported metadata without checking its content again. */
export function parseRemovedPagePreview(value: unknown): RemovedPagePreview {
  if (!record(value) || value.schemaVersion !== 3)
    invalidData("$preview", "unsupported preview version");
  return structuredClone(value) as RemovedPagePreview;
}
