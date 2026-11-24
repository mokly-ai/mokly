/**
 * The comparison details in the Changes tab of a use case, a Markdown
 * document, or a removed page or document, under the
 * [comparison details design](../../../../docs/protocol/mokly-component-workspace-design.md#comparison-details):
 * one sentence for each direct reason of the entry's detail, and a use case's
 * `Changed step:` lines. Only a record that Changes lists shows reasons. The
 * Compared rail names the branch point, so the details leave out its
 * sentence. `@mokly/ui/comparison-evidence` renders them.
 */

import { ComparisonEvidence } from "@mokly/ui/comparison-evidence";

import { detailKey } from "../catalogue/detail_fences.js";
import type { ShellCatalogueRoutedEntry } from "../catalogue/scoped_types.js";

import type { Catalogue } from "./catalogue.js";
import { changedSteps } from "./changed_steps.js";
import { shownReasons } from "./public_reasons.js";
import { reasonSentences } from "./reason_sentences.js";

/**
 * The entry's details from its held detail, which the route requests: the
 * current record's, or the removed record's of `snapshotId`. Until the detail
 * arrives, the details hold their heading alone.
 */
export function TargetEvidence({
  catalogue,
  entry,
  snapshotId,
}: {
  catalogue: Catalogue;
  entry: ShellCatalogueRoutedEntry;
  /** The removed record that the route names. */
  snapshotId: string | undefined;
}) {
  const held = catalogue.publicModel.details.get(
    detailKey({
      path: entry.path,
      ...(snapshotId === undefined ? {} : { snapshotId }),
    }),
  );
  const reasons = shownReasons(entry, held?.reasons);
  return (
    <ComparisonEvidence
      base=""
      changedSteps={
        entry.kind === "use-case"
          ? changedSteps(entry.steps, reasons, catalogue.publicModel.screens)
          : undefined
      }
      mark="data-workspace-evidence"
      reasons={reasonSentences(reasons ?? [])}
    />
  );
}
