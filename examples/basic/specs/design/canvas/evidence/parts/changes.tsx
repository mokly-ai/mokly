import { optional, useDesignInstance } from "../../../library/composition.js";
import { changeStepper } from "../../../library/panels/change-stepper.js";
import { compareModes } from "../../../library/panels/compare-modes.js";
import { ChangesCompared, ChangesEvidence } from "../../parts/changes.js";
import type {
  CompareFrame,
  CompareMode,
} from "../../parts/changes_sketches.js";
import type { CanvasDestination } from "../../parts/destinations.js";
import { InspectSection } from "../../parts/inspect.js";

import { BRANCH_CHANGES } from "./branches.js";
import { PAGE_FILES, type EvidenceFacts } from "./evidence.js";

/** The modes that the restyled Welcome's artboards show. */
export type StylesMode = Extract<CompareMode, "current" | "side-by-side">;

/**
 * The Changes tab of Welcome on a styles branch, where it is the one
 * change: the stepper, whose steps are both disabled; Compared; the compare
 * modes in the shown mode, with the compared frame of Side by side; and the
 * comparison details. Welcome's only reason is the changed stylesheet,
 * which reads only through the files, so no reason sentence leads them. No
 * artboard shows Welcome in another mode with the same catalogue filter, so
 * the other tiles and frame chips are pictures. The panel opens scrolled to
 * the comparison details.
 */
export function StylesChanges({
  design,
  facts,
  frame,
  mode,
}: {
  /** The artboard that renders the tab. */
  design: CanvasDestination;
  facts: EvidenceFacts;
  frame?: CompareFrame | undefined;
  mode: StylesMode;
}) {
  return (
    <>
      <changeStepper.Component
        moklyInstance={useDesignInstance("stepper")}
        position={1}
        total={BRANCH_CHANGES.styles}
      />
      <ChangesCompared />
      <InspectSection title="Compare">
        <compareModes.Component
          moklyInstance={useDesignInstance("modes")}
          mode={mode}
          comparable
          scrollTogether
          destinations={
            mode === "current"
              ? { current: design }
              : { "side-by-side": design }
          }
          {...optional("frame", frame)}
          {...optional(
            "frameDestination",
            frame === undefined ? undefined : design,
          )}
        />
      </InspectSection>
      <ChangesEvidence
        excluded={facts.excluded}
        files={facts.files}
        ignored={facts.ignored}
        initial
        reasons={["dependency"]}
      />
    </>
  );
}

/**
 * The Changes tab of the Getting started page, the first of the handbook
 * branch's changes: the stepper, whose Next change, the Action, has no
 * artboard on this branch; Compared; and the comparison details. A
 * whole-document page has no compare modes, so the tab holds none. Its
 * reasons are its changed stylesheets, which read only through the files,
 * each with the page's outcomes.
 */
export function PageChanges() {
  return (
    <>
      <changeStepper.Component
        moklyInstance={useDesignInstance("stepper")}
        position={1}
        total={BRANCH_CHANGES.handbook}
      />
      <ChangesCompared />
      <ChangesEvidence
        files={PAGE_FILES}
        initial
        mark="data-page-evidence"
        reasons={["dependency"]}
      />
    </>
  );
}
