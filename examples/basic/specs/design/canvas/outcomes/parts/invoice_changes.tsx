import { useDesignInstance } from "../../../library/composition.js";
import { changeStepper } from "../../../library/panels/change-stepper.js";
import { compareModes } from "../../../library/panels/compare-modes.js";
import { PREVIOUS_PATHS } from "../../../parts/entry_paths.js";
import { CHANGED_COUNT } from "../../../parts/nav_data.js";
import { ChangesCompared, ChangesEvidence } from "../../parts/changes.js";
import { CANVAS_PAGES } from "../../parts/destinations.js";
import { InspectSection } from "../../parts/inspect.js";
import { changePosition } from "../../parts/nav_rows.js";

import { OUTCOME_PAGES } from "./destinations.js";

/**
 * The Changes tab of the moved Invoice, after Welcome, Details and the
 * Example tour, and before its own Overdue variant: the stepper, whose
 * Previous change opens the Example tour in Changes and whose Next change,
 * its Overdue variant, has no artboard; Compared; the compare modes in
 * Overlay, the one mode that an artboard shows; and the comparison details,
 * which name its previous path as the earlier side before the sentence of
 * its reason.
 */
export function InvoiceChanges() {
  return (
    <>
      <changeStepper.Component
        moklyInstance={useDesignInstance("stepper")}
        position={changePosition("invoice")}
        total={CHANGED_COUNT}
        previousDestination={CANVAS_PAGES.useCaseChanges}
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
