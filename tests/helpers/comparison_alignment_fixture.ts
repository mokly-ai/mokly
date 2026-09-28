/**
 * A Git-backed repository for the comparison pane alignment specs, served live
 * or exported as a static artifact. It is dedicated to those specs, so the
 * shared comparison fixtures keep their classified counts.
 */

import {
  ALIGNMENT_CHANGED_COUNT,
  ALIGNMENT_LATE_IMAGE,
  ALIGNMENT_STYLES,
  comparisonAlignmentSource,
} from "./comparison_alignment_source.js";
import {
  exportComparisonCatalogue,
  serveComparisonCatalogue,
  type ComparisonCatalogue,
} from "./comparison_repository.js";

const alignmentCatalogue: ComparisonCatalogue = {
  changedCount: ALIGNMENT_CHANGED_COUNT,
  files: {
    "alignment.css": ALIGNMENT_STYLES,
    "alignment-late.svg": ALIGNMENT_LATE_IMAGE,
  },
  source: comparisonAlignmentSource,
  stylesheets: ["alignment.css"],
};

/** Serve the alignment catalogue against a real Git baseline. */
export function comparisonAlignmentFixture() {
  return serveComparisonCatalogue(alignmentCatalogue);
}

/** Export the alignment catalogue, with its packaged comparisons, to `site`. */
export function comparisonAlignmentExport() {
  return exportComparisonCatalogue(alignmentCatalogue);
}
