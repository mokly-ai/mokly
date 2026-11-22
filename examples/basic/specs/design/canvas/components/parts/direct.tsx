import type { EvidenceInputChange } from "../../../../../../../packages/ui/src/comparison-evidence/comparison-evidence.js";
import { useDesignInstance } from "../../../library/composition.js";
import { changeStepper } from "../../../library/panels/change-stepper.js";
import { compareModes } from "../../../library/panels/compare-modes.js";
import { MiniToolbarCard } from "../../../parts/mini_views.js";
import { reasonEvidence } from "../../../parts/reason_sentences.js";
import { ChangesCompared } from "../../parts/changes.js";
import type { CompareFrame } from "../../parts/changes_sketches.js";
import { sideBySideFrames, type CanvasFrameSpec } from "../../parts/frames.js";
import { InspectSection } from "../../parts/inspect.js";
import { WELCOME_INSTANCES } from "../../parts/instance_records.js";

import { BRANCH_CHANGES } from "./branch.js";
import { ChangesDetails, changedAction } from "./changes.js";
import { EXPLORER_PAGES as E } from "./destinations.js";
import { Before } from "./sketches.js";

/*
 * Welcome on the direct-change branch. The Action changed as on the Action
 * branch, and Welcome changed the label that it gives its own Action: at the
 * branch point it read Continue, and now it reads the label of the example's
 * Welcome. The current values come from Welcome's instance record, which
 * Inspect's Selection reads in the other Canvas artboards, so the paired
 * props, the frames, and the Selection show the same values.
 */

/** Welcome's own Action, whose label Welcome changed. */
const OWN_ACTION = WELCOME_INSTANCES.details;

/** The label that Welcome gave its own Action at the branch point. */
const EARLIER_LABEL = "Continue";

/** The current label of Welcome's own Action, from its instance record. */
function currentLabel(): string {
  const prop = OWN_ACTION.props.find(({ name }) => name === "label");
  const label: unknown =
    prop === undefined ? undefined : JSON.parse(prop.value);
  if (typeof label !== "string")
    throw new Error("Welcome's own Action has no label.");
  return label;
}

/**
 * The props that Welcome gives its own Action with a label, as the shell
 * writes a pair: each name in code-unit order with its value as code.
 */
function propsText(label: string): string {
  const props = OWN_ACTION.props
    .map((prop) =>
      prop.name === "label" ? { ...prop, value: JSON.stringify(label) } : prop,
    )
    .sort((left, right) => (left.name < right.name ? -1 : 1));
  const pairs = props.map(
    ({ name, value }) => `${JSON.stringify(name)}: ${value}`,
  );
  return `{${pairs.join(", ")}}`;
}

/** The views of Welcome, in the order of its entry detail. */
const VIEWS = [
  { viewport: "mobile", colorScheme: "light" },
  { viewport: "mobile", colorScheme: "dark" },
  { viewport: "desktop", colorScheme: "light" },
  { viewport: "desktop", colorScheme: "dark" },
] as const;

/**
 * The paired props of Welcome's own Action: its label changed in every view,
 * so each view names the instance with its Before and Current props.
 */
function inputChanges(): EvidenceInputChange[] {
  return VIEWS.map(({ colorScheme, viewport }) => ({
    after: propsText(currentLabel()),
    before: propsText(EARLIER_LABEL),
    colorScheme,
    instanceId: OWN_ACTION.id,
    key: `${OWN_ACTION.id}/${viewport}/${colorScheme}`,
    title: OWN_ACTION.component,
    viewport,
  }));
}

/**
 * One version of the example's Welcome, drawn as `MiniWelcome` of
 * `parts/mini_screens.tsx` draws it, whose own Action always reads the
 * example's label: here the own Action takes the given label and keeps its
 * width, above the Toolbar with the title and the slot text of the example's
 * Welcome. The link stays inert, because Canvas links stay inside the Canvas
 * family. A comparison is not highlighted, so the sketch draws no highlight
 * layer.
 */
function OwnLabelWelcome({
  compact,
  label,
}: {
  compact: boolean;
  label: string;
}) {
  return (
    <div className={compact ? "mbk-shot mbk-shot--compact" : "mbk-shot"}>
      <div className="mbk-shot-pad">
        <div className="mbk-shot-nav">
          {compact ? "Menu" : "Example navigation"}
        </div>
        <h2>Welcome to Mokly</h2>
        <span
          className="mbk-shot-action mbk-shot-action--primary mbk-shot-own-action"
          style={{ width: OWN_ACTION.box.width }}
        >
          {label}
        </span>
        <div className="mbk-shot-link-row">
          <span className="mbk-shot-link">Open the details screen</span>
        </div>
        <MiniToolbarCard
          text="Explore the catalogue."
          title="Workspace actions"
        />
      </div>
    </div>
  );
}

/**
 * Welcome's frames in Side by side: each frame as a pair, the version
 * before, with the earlier Action and its earlier label, beside the current
 * version. Both versions share the frame's size.
 */
export function directFrames(): CanvasFrameSpec[] {
  return sideBySideFrames((viewport, _scheme, version) => {
    const compact = viewport === "mobile";
    return version === "before" ? (
      <Before>
        <OwnLabelWelcome compact={compact} label={EARLIER_LABEL} />
      </Before>
    ) : (
      <OwnLabelWelcome compact={compact} label={currentLabel()} />
    );
  });
}

/**
 * The Changes tab of Welcome on the direct-change branch, the first of its
 * five changes: the stepper, Compared, the compare modes in Side by side
 * with the compared frame, and the comparison details, where the panel
 * opens. They read Welcome's two reasons, pair the props of its own Action
 * in each view, and link the changed Action. No artboard shows the Action's
 * own changes on this branch, or Welcome in another mode or frame, so Next
 * change, the other tiles, and the other chips are pictures.
 */
export function DirectChanges({ frame }: { frame: CompareFrame }) {
  return (
    <>
      <changeStepper.Component
        moklyInstance={useDesignInstance("stepper")}
        position={BRANCH_CHANGES.direct.welcomePosition}
        total={BRANCH_CHANGES.direct.total}
      />
      <ChangesCompared />
      <InspectSection title="Compare">
        <compareModes.Component
          moklyInstance={useDesignInstance("modes")}
          mode="side-by-side"
          comparable
          scrollTogether
          destinations={{ "side-by-side": E.explorerAffectedDirect }}
          frame={frame}
          frameDestination={E.explorerAffectedDirect}
        />
      </InspectSection>
      <ChangesDetails
        changedComponents={changedAction()}
        initial
        inputChanges={inputChanges()}
        reasons={reasonEvidence(["inputs", "material"])}
      />
    </>
  );
}
