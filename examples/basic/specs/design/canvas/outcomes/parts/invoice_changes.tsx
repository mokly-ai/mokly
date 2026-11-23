import { useDesignInstance } from "../../../library/composition.js";
import { changeStepper } from "../../../library/panels/change-stepper.js";
import { compareModes } from "../../../library/panels/compare-modes.js";
import { PREVIOUS_PATHS } from "../../../parts/entry_paths.js";
import { CHANGED_COUNT } from "../../../parts/nav_data.js";
import { ChangesCompared, ChangesEvidence } from "../../parts/changes.js";
import { CANVAS_PAGES } from "../../parts/destinations.js";
import { InspectSection } from "../../parts/inspect.js";
import { CANVAS_CHANGES_ROWS } from "../../parts/nav_rows.js";

import { OUTCOME_PAGES } from "./destinations.js";

/**
 * Invoice's place among the entries that the Changes filter lists, in the
 * filter's order: after Welcome and Details, and before its own Overdue
 * variant.
 */
const POSITION =
  CANVAS_CHANGES_ROWS.filter((row) => row.kind !== "folder").findIndex(
    (row) => row.key === "invoice",
  ) + 1;

/**
 * The Changes tab of the moved Invoice: the stepper, whose Previous change
 * opens Details in Changes and whose Next change, its Overdue variant, has
 * no artboard; Compared; the compare modes in Overlay, the one mode that an
 * artboard shows; and the comparison details, which name its previous path
 * as the earlier side before the sentence of its reason.
 */
export function InvoiceChanges() {
  return (
    <>
      <changeStepper.Component
        moklyInstance={useDesignInstance("stepper")}
        position={POSITION}
        total={CHANGED_COUNT}
        previousDestination={CANVAS_PAGES.addedChanges}
      />
      <ChangesCompared />
      <InspectSection title="Compare">
        <compareModes.Component
          moklyInstance={useDesignInstance("modes")}
          mode="overlay"
          comparable
          scrollTogether
          destinations={{ overlay: OUTCOME_PAGES.moved }}
        />
      </InspectSection>
      <ChangesEvidence
        previousPath={PREVIOUS_PATHS.invoice}
        reasons={["material"]}
      />
    </>
  );
}
