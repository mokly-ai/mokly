import type { ComponentProps } from "react";

import { mockLink } from "@mokly/mokly";

import {
  ComparisonEvidence,
  type EvidenceLink,
} from "../../../../../../../packages/ui/src/comparison-evidence/comparison-evidence.js";
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
import type { CanvasFrameSpec } from "../../parts/frames.js";
import { InspectSection } from "../../parts/inspect.js";
import { actionFrames } from "../../parts/set_sketches.js";

import { BRANCH_CHANGES } from "./branch.js";
import { EXPLORER_PAGES as E } from "./destinations.js";
import { compactFrames } from "./sketches.js";

/** The modes that the changed Default variant's artboards show. */
export type DefaultMode = Extract<
  CompareMode,
  "current" | "difference" | "overlay" | "side-by-side"
>;

/** The artboard of the changed Default variant in each mode that one shows. */
export const DEFAULT_MODES = {
  current: E.explorerCompareCurrent,
  "side-by-side": E.explorerCompareSide,
  overlay: E.explorerCompare,
  difference: E.explorerCompareDifference,
} as const satisfies Record<DefaultMode, CanvasDestination>;

/** The frame of the Action's set that Side by side compares on Default's page. */
export const DEFAULT_FRAME = "default-light";

/** The frame of the removed Compact that its comparison compares. */
export const COMPACT_FRAME = "compact-light";

/**
 * A variant set's frames as Side by side's chips: each frame by its saved
 * variant and scheme, with the component glyph.
 */
function setChips(frames: readonly CanvasFrameSpec[]) {
  return frames.map(({ id, label }) => ({
    id,
    kind: "component" as const,
    label,
  }));
}

/**
 * The comparison details: the shipped evidence in Inspect's type. The rail
 * of Compared names the base, so the evidence leaves out its branch-point
 * sentence.
 */
export function ChangesDetails({
  initial,
  ...props
}: Omit<ComponentProps<typeof ComparisonEvidence>, "base" | "mark"> & {
  /** The panel opens scrolled to the comparison details. */
  initial?: boolean | undefined;
}) {
  return (
    <div
      className={`cv-sec cv-evidence cv-cx-evidence${initial ? " cv-initial" : ""}`}
    >
      <ComparisonEvidence base="" mark="data-workspace-evidence" {...props} />
    </div>
  );
}

/**
 * The changed Action, as a screen's comparison details link it: the link
 * opens the Action's changed Default variant on its Changes tab, in Current.
 */
export function changedAction(): EvidenceLink[] {
  return [
    {
      href: mockLink(E.explorerCompareCurrent),
      key: "action",
      title: "Action",
    },
  ];
}

/**
 * The Changes tab of the Action's saved variant Default, the second of the
 * Action branch's four changes: the stepper, Compared, the compare modes in
 * the shown mode, and the comparison details, which name the saved variant
 * and its unchanged saved props. Side by side offers a chip for each frame
 * of the set and compares Default · Light. No artboard shows the Action's
 * own changes or Disabled's, so Previous change and Next change are
 * pictures, and no artboard shows the set in Swipe or another frame's pair,
 * so that tile and those chips are pictures too.
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
          {...(mode === "side-by-side"
            ? {
                frame: DEFAULT_FRAME,
                frames: setChips(actionFrames()),
                frameDestination: E.explorerCompareSide,
              }
            : {})}
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
        changedComponents={changedAction()}
        sharedImpact={SCREEN_STYLE_COPY.sharedImpact}
      />
    </>
  );
}

/**
 * The Changes tab of the removed Compact, the last change of the removal
 * branch, whose Previous change opens Farewell's Changes tab: a removed
 * component variant stays eligible for comparison with a missing current
 * side, so the rail names both versions and every mode is offered, and its
 * comparison falls back to Side by side. Only Compact's frames compare, so
 * Side by side offers their chips and compares Compact · Light. No artboard
 * shows this tab in Current, Compact · Dark's pair, or another mode, which
 * falls back to Side by side, so those tiles and that chip are pictures.
 */
export function RemovedChanges() {
  return (
    <>
      <changeStepper.Component
        moklyInstance={useDesignInstance("stepper")}
        position={BRANCH_CHANGES.removal.compactPosition}
        total={BRANCH_CHANGES.removal.total}
        previousDestination={E.explorerConsumerChanges}
      />
      <ChangesCompared />
      <InspectSection title="Compare">
        <compareModes.Component
          moklyInstance={useDesignInstance("modes")}
          mode="side-by-side"
          comparable
          scrollTogether
          destinations={{ "side-by-side": E.explorerRemovedChanges }}
          frame={COMPACT_FRAME}
          frames={setChips(compactFrames())}
          frameDestination={E.explorerRemovedChanges}
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
