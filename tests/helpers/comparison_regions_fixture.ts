/**
 * A Git-backed repository for the inner scroll region specs, served live or
 * exported as a static artifact, dedicated to those specs so the shared
 * comparison fixtures keep their classified counts.
 */

import {
  REGION_STYLES,
  REGIONS_CHANGED_COUNT,
  comparisonRegionsSource,
} from "./comparison_regions_source.js";
import {
  exportComparisonCatalogue,
  serveComparisonCatalogue,
  type ComparisonCatalogue,
} from "./comparison_repository.js";

const regionsCatalogue: ComparisonCatalogue = {
  changedCount: REGIONS_CHANGED_COUNT,
  files: { "regions.css": REGION_STYLES },
  source: comparisonRegionsSource,
  stylesheets: ["regions.css"],
};

/** Serve the region catalogue against a real Git baseline. */
export function comparisonRegionsFixture() {
  return serveComparisonCatalogue(regionsCatalogue);
}

/** Export the region catalogue, with its packaged comparisons, to `site`. */
export function comparisonRegionsExport() {
  return exportComparisonCatalogue(regionsCatalogue);
}
