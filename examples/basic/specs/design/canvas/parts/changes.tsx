import {
  ComparisonEvidence,
  type EvidenceExclusions,
  type EvidenceFiles,
} from "../../../../../../packages/ui/src/comparison-evidence/comparison-evidence.js";
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
import { changePosition } from "./nav_rows.js";

/**
 * The content of Welcome that the example excludes from comparisons, its
 * navigation. The comparison details of a Welcome that differs name it.
 */
export const WELCOME_EXCLUDED_CONTENT = ["example-nav"];

/**
 * Compared: the version before and the current version on a two-dot rail.
 * The version before is the branch point on the base, and the current
 * version is the branch. An entry that the branch added has no version
 * before, so its rail holds the current version alone, and a line says why.
 * An entry that the branch removed has no current version, so its rail holds
 * the version before alone, which the canvas shows, and a line says why.
 */
export function ChangesCompared({
  added = false,
  removed = false,
}: {
  added?: boolean;
  removed?: boolean;
}) {
  return (
    <InspectSection title="Compared">
      <ol
        className="cv-refs"
        data-cv-added={added ? "" : undefined}
        data-cv-removed={removed ? "" : undefined}
      >
        {added ? null : (
          <li className="cv-ref" data-side="before">
            <span aria-hidden="true" className="cv-ref-dot" />
            <span className="cv-ref-side">Before</span>{" "}
            <span className="cv-ref-name">
              Branch point on <code>origin/main</code>
            </span>
          </li>
        )}
        {removed ? null : (
          <li className="cv-ref" data-side="after">
            <span aria-hidden="true" className="cv-ref-dot" />
            <span className="cv-ref-side">Current</span>{" "}
            <span className="cv-ref-name">This branch</span>
          </li>
        )}
      </ol>
      {added ? (
        <p className="cv-hint">
          Added on this branch, so there is no base to compare.
        </p>
      ) : null}
      {removed ? (
        <p className="cv-hint">
          Removed on this branch, so there is no current version to compare.
        </p>
      ) : null}
    </InspectSection>
  );
}

/**
 * The comparison details of today's inspector: the shipped evidence with the
 * outcome line of each frame that a loaded comparison compares, then the
 * previous path of a moved entry, which the evidence names as the earlier
 * side, one sentence for each reason, each changed file with its outcomes,
 * the stylesheets that were examined and excluded, and the content that the
 * comparison leaves out. The rail above names the base, so the evidence
 * leaves out its branch-point sentence.
 */
export function ChangesEvidence({
  excluded,
  files,
  ignored,
  initial,
  mark = "data-workspace-evidence",
  outcomes,
  previousPath,
  reasons,
}: {
  /** The stylesheets that were examined and excluded. */
  excluded?: EvidenceExclusions | undefined;
  /** The changed files, each named once with its outcomes. */
  files?: EvidenceFiles | undefined;
  /** The ids of the content that the comparison leaves out. */
  ignored?: readonly string[] | undefined;
  /** The panel opens scrolled to the comparison details. */
  initial?: boolean | undefined;
  /** The mark of the evidence: a whole-document page has its own. */
  mark?: "data-page-evidence" | "data-workspace-evidence";
  /**
   * The outcome line of each frame that a loaded comparison compares; none
   * in Current, which loads no comparison.
   */
  outcomes?: readonly string[] | undefined;
  /** The path that a moved entry had at the branch point. */
  previousPath?: string | undefined;
  reasons: readonly ChangeReasonKind[];
}) {
  return (
    <div
      className={
        initial ? "cv-sec cv-evidence cv-initial" : "cv-sec cv-evidence"
      }
    >
      <ComparisonEvidence
        base=""
        excluded={excluded}
        files={files}
        ignored={ignored}
        mark={mark}
        outcomes={outcomes}
        previousPath={previousPath}
        reasons={reasonEvidence(reasons)}
      />
    </div>
  );
}

/**
 * The Changes tab of Welcome, the first of the branch's changes: the
 * stepper, whose Next change opens Details in Changes; Compared; the compare
 * modes in the shown mode, with the compared frame of Side by side; and the
 * comparison details, which list each compared frame's outcome in a loaded
 * comparison and end with Welcome's excluded content. The cloud's check
 * stands between the stepper and Compared; the open-source panel leaves that
 * place empty.
 */
export function WelcomeChanges({
  frame,
  mode,
  outcomes,
}: {
  frame?: CompareFrame | undefined;
  mode: CompareMode;
  /** The outcome line of each compared frame, in a mode other than Current. */
  outcomes?: readonly string[] | undefined;
}) {
  return (
    <>
      <changeStepper.Component
        moklyInstance={useDesignInstance("stepper")}
        position={changePosition("welcome")}
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
      <ChangesEvidence
        ignored={WELCOME_EXCLUDED_CONTENT}
        outcomes={outcomes}
        reasons={["material"]}
      />
    </>
  );
}

/**
 * The Changes tab of Details, which the branch added, the second of its
 * changes: the stepper, whose Previous change opens Welcome in Changes and
 * whose Next change opens the Example tour in Changes, the current version
 * alone, the compare modes reduced to Current, and the comparison details
 * with the sentence of its reason.
 */
export function DetailsChanges() {
  return (
    <>
      <changeStepper.Component
        moklyInstance={useDesignInstance("stepper")}
        position={changePosition("details")}
        total={CHANGED_COUNT}
        previousDestination={C.changesCurrent}
        nextDestination={C.useCaseChanges}
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
      <ChangesEvidence reasons={["added"]} />
    </>
  );
}
