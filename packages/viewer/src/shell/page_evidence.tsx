/** The comparison details that a whole-document page shows in its Details. */

import { entryWording } from "./entry_wording.js";
import { ComparisonHeading, StylesheetDetails } from "./evidence_details.js";
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
    <section className="mbk-comparison-evidence" data-page-evidence="">
      <ComparisonHeading base={base} />
      <StylesheetDetails
        reasons={evidence.resources?.reasons ?? []}
        resources={evidence.resources ? [evidence.resources] : []}
        subject={{ kind: "page" }}
      />
      {evidence.status === "Unmodified" ? (
        <p>{entryWording("page").noChanges}</p>
      ) : null}
    </section>
  );
}
