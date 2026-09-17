import type { Manifest } from "@mokly/viewer/data";
import { createCatalogue } from "@mokly/viewer/server";
import type { Catalogue } from "@mokly/viewer/server";

import type { CatalogueMetadata } from "../registry/catalogue_index.js";
import { removedManifestEntries } from "../registry/changes.js";

/** Preserve baseline leaves without inserting them into current ownership. */
export function catalogueAtBaseline(
  manifest: CatalogueMetadata,
  baseline: Manifest,
): Catalogue {
  return createCatalogue(manifest, removedManifestEntries(manifest, baseline));
}
