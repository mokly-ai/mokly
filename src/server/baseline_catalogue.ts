import type { HistoricalManifest } from "@mokly/viewer/data";
import { createCatalogue } from "@mokly/viewer/server";
import type { Catalogue } from "@mokly/viewer/server";

import type { CatalogueMetadata } from "../registry/catalogue_index.js";
import { removedManifestEntries } from "../registry/changes.js";
import type { EntryMove } from "../review/moves/types.js";

import type { ComponentChangeSnapshot } from "./component_change_types.js";

/** Preserve baseline leaves without inserting them into current ownership. */
export function catalogueAtBaseline(
  manifest: CatalogueMetadata,
  baseline: HistoricalManifest,
  moves: readonly EntryMove[] = [],
): Catalogue {
  return createCatalogue(
    manifest,
    removedManifestEntries(manifest, baseline, moves),
    moves,
  );
}

/** Consume an accepted generation so callers cannot omit its move pairings. */
export function catalogueWithChanges(
  manifest: CatalogueMetadata,
  changes: Pick<ComponentChangeSnapshot, "baseline" | "pairing">,
): Catalogue {
  return catalogueAtBaseline(
    manifest,
    changes.baseline,
    changes.pairing?.moves,
  );
}
