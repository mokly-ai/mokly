/**
 * The comparison details that a whole-document page shows in its Details.
 * This container words the page's evidence, and
 * `@mokly/ui/comparison-evidence` renders it.
 */

import { ComparisonEvidence } from "@mokly/ui/comparison-evidence";

import { entryWording } from "./entry_wording.js";
import { stylesheetDetails } from "./evidence_details.js";
import type { PageComparisonEvidence } from "./page_evidence_data.js";

/**
 * A page has no comparison controls, so its Details carry its evidence: each
 * changed file with the page sentences, the stylesheets examined and excluded,
 * and the terminal line of an unmodified page. A page consumes no components,
 * so no changed component is linked. Nothing renders until the status is known.
 */
export function PageEvidence({
  base,
  evidence,
}: {
  base: string;
  evidence: PageComparisonEvidence;
}) {
  if (!evidence.status) return null;
  return (
    <ComparisonEvidence
      base={base}
      mark="data-page-evidence"
      noChanges={
        evidence.status === "Unmodified"
          ? entryWording("page").noChanges
          : undefined
      }
      {...stylesheetDetails(
        evidence.resources?.reasons ?? [],
        evidence.resources ? [evidence.resources] : [],
        { kind: "page" },
      )}
    />
  );
}
