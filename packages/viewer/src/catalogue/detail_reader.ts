/** The entry detail v4 reader: gate the version and copy its content. */

import type { EntryDetailV4 } from "@mokly/model";

import { record } from "../components/data.js";

import { MoklyVersionError } from "./version_error.js";

/** The only entry detail number this viewer reads. */
const ENTRY_DETAIL_VERSION = 4;

/** The receiver checks content. Delivery fences bind this copy to its index. */
export function readEntryDetail(value: unknown): EntryDetailV4 {
  const version = record(value) ? value.schemaVersion : undefined;
  if (version !== ENTRY_DETAIL_VERSION)
    throw new MoklyVersionError("detail", version, ENTRY_DETAIL_VERSION);
  return structuredClone(value) as EntryDetailV4;
}
