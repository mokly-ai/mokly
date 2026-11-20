import { ScreenControls } from "../../components/controls/parts/screen_controls.js";
import type { FramesFilterProps } from "../../library/inspector/frames-filter.js";
import { SUBJECTS } from "../../parts/subjects.js";

import type { CanvasDestination } from "./destinations.js";
import { CANVAS_ENTRIES } from "./entries.js";
import {
  InspectFold,
  InspectFrames,
  InspectHead,
  InspectRationale,
  InspectSelection,
  InspectVariants,
} from "./inspect.js";
import { SubjectRows } from "./inspect_entries.js";
import { ScreenUsage, WelcomeComponents } from "./inspect_folds.js";
import { InspectSelected } from "./inspect_selection.js";
import {
  WELCOME_INSTANCES,
  type WelcomeInstanceId,
} from "./welcome_instances.js";

/** A folded section of Inspect, by its name. */
type InspectFoldName = "components" | "props" | "usage";

/** The four frames of a screen in both schemes, as the Frames filter shows them. */
const ALL_FRAMES = {
  count: 4,
  filter: {
    viewports: true,
    mobile: true,
    desktop: true,
    light: true,
    dark: true,
    highlight: false,
  },
} as const satisfies { count: number; filter: FramesFilterProps };

interface WelcomeInspectProps {
  /** The artboard that renders this Inspect. */
  design?: CanvasDestination | undefined;
  /** The instance that the reader selected on a frame; none by default. */
  selected?: WelcomeInstanceId | undefined;
  /** The folded sections that start unfolded. */
  open?: readonly InspectFoldName[] | undefined;
  /** The section that the panel opens scrolled to. */
  initial?: InspectFoldName | "frames" | "selection" | undefined;
  /** The Frames section: the shown frames, and the filter's state. */
  frames?: { count: number; filter: FramesFilterProps } | undefined;
}

/**
 * Inspect for Welcome: changed on the canonical branch, in both schemes. The
 * Selection section shows the selected instance, and the folded sections
 * hold Welcome's props controls, its usage, and its component tree.
 */
export function WelcomeInspect({
  design,
  frames = ALL_FRAMES,
  initial,
  open = [],
  selected,
}: WelcomeInspectProps) {
  const subject = SUBJECTS.welcome;
  return (
    <>
      <InspectHead
        description={subject.description}
        entry={CANVAS_ENTRIES.welcome}
        rows={<SubjectRows subject="welcome" />}
        source={subject.source}
      />
      <InspectRationale noun="screen" text={subject.rationale} />
      <InspectVariants
        variants={[
          { label: "Welcome", current: true },
          { label: "Empty workspace" },
          { label: "Save failed" },
        ]}
      />
      <InspectFrames
        count={frames.count}
        filter={frames.filter}
        initial={initial === "frames"}
      />
      {selected === undefined ? (
        <InspectSelection />
      ) : (
        <InspectSelected
          initial={initial === "selection"}
          instance={WELCOME_INSTANCES[selected]}
        />
      )}
      <InspectFold
        count={1}
        initial={initial === "props"}
        name="props"
        open={open.includes("props")}
        title="Props"
      >
        <ScreenControls />
      </InspectFold>
      <InspectFold
        initial={initial === "usage"}
        name="usage"
        open={open.includes("usage")}
        title="Usage"
      >
        <ScreenUsage />
      </InspectFold>
      <InspectFold
        count={2}
        initial={initial === "components"}
        name="components"
        open={open.includes("components")}
        title="Components"
      >
        <WelcomeComponents
          design={design}
          expanded={open.includes("components")}
          selected={selected}
        />
      </InspectFold>
    </>
  );
}
