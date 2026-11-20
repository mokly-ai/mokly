import { ComparisonEvidence } from "../../../../../../packages/ui/src/comparison-evidence/comparison-evidence.js";
import { optional, useDesignInstance } from "../../library/composition.js";
import { changeStepper } from "../../library/panels/change-stepper.js";
import { compareModes } from "../../library/panels/compare-modes.js";
import { CHANGED_COUNT } from "../../parts/nav_data.js";
import {
  reasonEvidence,
  type ChangeReasonKind,
} from "../../parts/reason_sentences.js";

import type { CompareFrame, CompareMode } from "./changes_sketches.js";
import { CANVAS_PAGES as C, WELCOME_MODES } from "./destinations.js";
import { InspectSection } from "./inspect.js";

/**
 * Compared: the version before and the current version on a two-dot rail.
 * The version before is the branch point on the base, and the current
 * version is the branch. An entry that the branch added has no version
 * before, so its rail holds the current version alone, and a line says why.
 */
function ChangesCompared({ added = false }: { added?: boolean }) {
  return (
    <InspectSection title="Compared">
      <ol className="cv-refs" data-cv-added={added ? "" : undefined}>
        {added ? null : (
          <li className="cv-ref" data-side="before">
            <span aria-hidden="true" className="cv-ref-dot" />
            <span className="cv-ref-side">Before</span>{" "}
            <span className="cv-ref-name">
              Branch point on <code>origin/main</code>
            </span>
          </li>
        )}
        <li className="cv-ref" data-side="after">
          <span aria-hidden="true" className="cv-ref-dot" />
          <span className="cv-ref-side">Current</span>{" "}
          <span className="cv-ref-name">This branch</span>
        </li>
      </ol>
      {added ? (
        <p className="cv-hint">
          Added on this branch, so there is no base to compare.
        </p>
      ) : null}
    </InspectSection>
  );
}

/**
 * The comparison details of today's inspector: the shipped evidence with one
 * sentence for each reason. The rail above names the base, so the evidence
 * leaves out its branch-point sentence.
 */
function ChangesEvidence({
  reasons,
}: {
  reasons: readonly ChangeReasonKind[];
}) {
  return (
    <div className="cv-sec cv-evidence">
      <ComparisonEvidence
        base=""
        mark="data-workspace-evidence"
        reasons={reasonEvidence(reasons)}
      />
    </div>
  );
}

/**
 * The Changes tab of Welcome, the first of the branch's changes: the
 * stepper, whose Next change opens Details in Changes; Compared; the compare
 * modes in the shown mode, with the compared frame of Side by side; and the
 * comparison details. The cloud's check stands between the stepper and
 * Compared; the open-source panel leaves that place empty.
 */
export function WelcomeChanges({
  frame,
  mode,
}: {
  frame?: CompareFrame | undefined;
  mode: CompareMode;
}) {
  return (
    <>
      <changeStepper.Component
        moklyInstance={useDesignInstance("stepper")}
        position={1}
        total={CHANGED_COUNT}
        nextDestination={C.addedChanges}
      />
      <ChangesCompared />
      <InspectSection title="Compare">
        <compareModes.Component
          moklyInstance={useDesignInstance("modes")}
          mode={mode}
          comparable
          scrollTogether
          destinations={WELCOME_MODES}
          {...optional("frame", frame)}
          {...optional(
            "frameDestination",
            frame === undefined ? undefined : C.changesSide,
          )}
        />
      </InspectSection>
      <ChangesEvidence reasons={["material"]} />
    </>
  );
}

/**
 * The Changes tab of Details, which the branch added, the second of its
 * changes: the stepper, whose Previous change opens Welcome in Changes, the
 * current version alone, and the compare modes reduced to Current.
 */
export function DetailsChanges() {
  return (
    <>
      <changeStepper.Component
        moklyInstance={useDesignInstance("stepper")}
        position={2}
        total={CHANGED_COUNT}
        previousDestination={C.changesCurrent}
      />
      <ChangesCompared added />
      <InspectSection title="Compare">
        <compareModes.Component
          moklyInstance={useDesignInstance("modes")}
          mode="current"
          comparable={false}
          scrollTogether
          destinations={{ current: C.addedChanges }}
        />
      </InspectSection>
    </>
  );
}
