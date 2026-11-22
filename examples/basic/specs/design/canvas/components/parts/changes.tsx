import type { ComponentProps } from "react";

import { mockLink } from "@mokly/mokly";

import { ComparisonEvidence } from "../../../../../../../packages/ui/src/comparison-evidence/comparison-evidence.js";
import { useDesignInstance } from "../../../library/composition.js";
import { changeStepper } from "../../../library/panels/change-stepper.js";
import { compareModes } from "../../../library/panels/compare-modes.js";
import { reasonEvidence } from "../../../parts/reason_sentences.js";
import { SCREEN_STYLE_COPY } from "../../../parts/stylesheet_evidence.js";
import { ChangesCompared } from "../../parts/changes.js";
import type {
  CompareFrame,
  CompareMode,
} from "../../parts/changes_sketches.js";
import type { CanvasDestination } from "../../parts/destinations.js";
import { InspectSection } from "../../parts/inspect.js";

import { BRANCH_CHANGES } from "./branch.js";
import { EXPLORER_PAGES as E } from "./destinations.js";

/** The modes that the changed Default variant's artboards show. */
export type DefaultMode = Extract<
  CompareMode,
  "current" | "difference" | "overlay"
>;

/** The artboard of the changed Default variant in each mode that one shows. */
export const DEFAULT_MODES = {
  current: E.explorerCompareCurrent,
  overlay: E.explorerCompare,
  difference: E.explorerCompareDifference,
} as const satisfies Record<DefaultMode, CanvasDestination>;

/**
 * The comparison details: the shipped evidence in Inspect's type. The rail
 * of Compared names the base, so the evidence leaves out its branch-point
 * sentence.
 */
function ChangesDetails(
  props: Omit<ComponentProps<typeof ComparisonEvidence>, "base" | "mark">,
) {
  return (
    <div className="cv-sec cv-evidence cv-cx-evidence">
      <ComparisonEvidence base="" mark="data-workspace-evidence" {...props} />
    </div>
  );
}

/**
 * The Changes tab of the Action's saved variant Default, the second of the
 * Action branch's four changes: the stepper, Compared, the compare modes in
 * the shown mode, and the comparison details, which name the saved variant
 * and its unchanged saved props. No artboard shows the Action's own changes
 * or Disabled's, so Previous change and Next change are pictures, and no
 * artboard shows a variant set in Side by side or Swipe, so their tiles are
 * pictures too.
 */
export function DefaultChanges({ mode }: { mode: DefaultMode }) {
  return (
    <>
      <changeStepper.Component
        moklyInstance={useDesignInstance("stepper")}
        position={BRANCH_CHANGES.action.defaultPosition}
        total={BRANCH_CHANGES.action.total}
      />
      <ChangesCompared />
      <InspectSection title="Compare">
        <compareModes.Component
          moklyInstance={useDesignInstance("modes")}
          mode={mode}
          comparable
          scrollTogether
          destinations={DEFAULT_MODES}
        />
      </InspectSection>
      <ChangesDetails
        reasons={reasonEvidence(["material"])}
        savedVariant={{ savedPropsUnchanged: true, title: "Default" }}
      />
    </>
  );
}

/**
 * The Changes tab of a screen that the changed Action affects. The Changes
 * filter does not list it, so it has no stepper. Side by side compares the
 * frame that the artboard shows, and the comparison details name the changed
 * Action, which opens its Changes tab, and end with the shared-impact
 * sentence. No artboard shows the screen in another mode, so the other
 * tiles are pictures.
 */
export function AffectedChanges({
  design,
  frame,
}: {
  /** The artboard that renders the tab. */
  design: CanvasDestination;
  frame: CompareFrame;
}) {
  return (
    <>
      <ChangesCompared />
      <InspectSection title="Compare">
        <compareModes.Component
          moklyInstance={useDesignInstance("modes")}
          mode="side-by-side"
          comparable
          scrollTogether
          destinations={{ "side-by-side": design }}
          frame={frame}
          frameDestination={design}
        />
      </InspectSection>
      <ChangesDetails
        changedComponents={[
          {
            href: mockLink(E.explorerCompareCurrent),
            key: "action",
            title: "Action",
          },
        ]}
        sharedImpact={SCREEN_STYLE_COPY.sharedImpact}
      />
    </>
  );
}

/**
 * The Changes tab of the removed Compact, the one change of the removal
 * branch: a removed component variant stays eligible for comparison, so the
 * rail names both versions and every mode is offered. Its missing current
 * side makes a comparison fall back to Side by side, which no artboard shows
 * for a variant set, so every mode but Current is a picture.
 */
export function RemovedChanges() {
  return (
    <>
      <changeStepper.Component
        moklyInstance={useDesignInstance("stepper")}
        position={BRANCH_CHANGES.removal.compactPosition}
        total={BRANCH_CHANGES.removal.total}
      />
      <ChangesCompared />
      <InspectSection title="Compare">
        <compareModes.Component
          moklyInstance={useDesignInstance("modes")}
          mode="current"
          comparable
          scrollTogether
          destinations={{ current: E.explorerRemovedChanges }}
        />
      </InspectSection>
      <ChangesDetails
        reasons={reasonEvidence(["removed"])}
        savedVariant={{ savedPropsUnchanged: false, title: "Compact" }}
      />
    </>
  );
}

/** The frame that an affected screen's Side by side compares in a viewport. */
export function affectedFrame(viewport: "desktop" | "mobile"): CompareFrame {
  return viewport === "desktop" ? "desktop-light" : "mobile-light";
}
