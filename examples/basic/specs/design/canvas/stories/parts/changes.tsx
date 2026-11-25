import { useDesignInstance } from "../../../library/composition.js";
import { changeStepper } from "../../../library/panels/change-stepper.js";
import { compareModes } from "../../../library/panels/compare-modes.js";
import { reasonEvidence } from "../../../parts/reason_sentences.js";
import { ChangesDetails } from "../../components/parts/changes.js";
import { ChangesCompared } from "../../parts/changes.js";
import { InspectSection } from "../../parts/inspect.js";

import { STORY_CHANGES } from "./branch.js";
import { STORY_PAGES as S } from "./destinations.js";
import { expandedFrames } from "./sketches.js";

/** The frame of Expanded that its comparison compares on a desktop. */
export const EXPANDED_FRAME = "expanded-light";

/**
 * The Changes tab of the failed Expanded story, the first of the branch's
 * two changes. The error document is the view's new content, so the story
 * reads as an ordinary changed variant: the stepper, Compared, the compare
 * modes in Side by side with a chip for each of Expanded's frames, and the
 * comparison details, which list each compared frame's outcome and name the
 * story's unchanged args. No artboard shows the added Disabled's Changes
 * tab, Expanded · Dark's pair, or another mode, so Next change, that chip,
 * and the other tiles are pictures.
 */
export function ExpandedChanges({
  outcomes,
}: {
  /** The outcome line of each of Expanded's compared frames. */
  outcomes: readonly string[];
}) {
  return (
    <>
      <changeStepper.Component
        moklyInstance={useDesignInstance("stepper")}
        position={STORY_CHANGES.expandedPosition}
        total={STORY_CHANGES.total}
      />
      <ChangesCompared />
      <InspectSection title="Compare">
        <compareModes.Component
          moklyInstance={useDesignInstance("modes")}
          mode="side-by-side"
          comparable
          scrollTogether
          destinations={{ "side-by-side": S.storyFailedChanges }}
          frame={EXPANDED_FRAME}
          frames={expandedFrames().map(({ id, label }) => ({
            id,
            kind: "component" as const,
            label,
          }))}
          frameDestination={S.storyFailedChanges}
        />
      </InspectSection>
      <ChangesDetails
        initial
        outcomes={outcomes}
        reasons={reasonEvidence(["material"])}
        savedVariant={{ savedPropsUnchanged: true, title: "Expanded" }}
      />
    </>
  );
}
