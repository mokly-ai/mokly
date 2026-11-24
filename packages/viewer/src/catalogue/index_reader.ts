/** The catalogue index v9 version gate and readers. */

import type { CatalogueReadModel } from "@mokly/model";

import { record } from "../components/data.js";

import type { FetchedJson } from "./sources.js";
import { MoklyVersionError } from "./version_error.js";

/** The only catalogue index number this viewer reads. */
const CATALOGUE_INDEX_VERSION = 9;

/** The receiver checks content. The viewer owns a copy of its supported format. */
export function readCatalogueIndex(value: unknown): CatalogueReadModel {
  return structuredClone(checkCatalogueIndex(value));
}

/** Adopt the parsed index. The caller must hold the only reference to it. */
export function adoptFetchedCatalogueIndex(
  value: FetchedJson,
): CatalogueReadModel {
  return checkCatalogueIndex(value);
}

function checkCatalogueIndex(value: unknown): CatalogueReadModel {
  const version = record(value) ? value.schemaVersion : undefined;
  if (version !== CATALOGUE_INDEX_VERSION)
    throw new MoklyVersionError("catalogue", version, CATALOGUE_INDEX_VERSION);
  return value as CatalogueReadModel;
}
