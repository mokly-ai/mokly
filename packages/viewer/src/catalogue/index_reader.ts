/** The catalogue index v9 reader: gate the version and copy its content. */

import { record } from "../components/data.js";

import type { CatalogueReadModel } from "./types.js";
import { MoklyVersionError } from "./version_error.js";

/** The only catalogue index number this viewer reads. */
const CATALOGUE_INDEX_VERSION = 9;

/** The receiver checks content. The viewer owns a copy of its supported format. */
export function readCatalogueIndex(value: unknown): CatalogueReadModel {
  const version = record(value) ? value.schemaVersion : undefined;
  if (version !== CATALOGUE_INDEX_VERSION)
    throw new MoklyVersionError("catalogue", version, CATALOGUE_INDEX_VERSION);
  return structuredClone(value) as CatalogueReadModel;
}
