import type { ReactNode } from "react";

import type { FramesFilterProps } from "../../library/inspector/frames-filter.js";
import { SUBJECTS, type ScreenSubject } from "../../parts/subjects.js";
import type { CatalogueTag } from "../../parts/tags.js";

import type { CanvasDestination } from "./destinations.js";
import type { CanvasEntry } from "./entries.js";
import {
  InspectFold,
  InspectFrames,
  InspectHead,
  InspectRationale,
  InspectSelection,
} from "./inspect.js";
import { SubjectRows } from "./inspect_entries.js";
import { InstanceComponents, ScreenUsage } from "./inspect_folds.js";
import { InspectSelected } from "./inspect_selection.js";
import { InspectVariants, type InspectVariant } from "./inspect_variants.js";
import type { CanvasInstance, InstanceRecords } from "./instances.js";

/** A folded section of Inspect, by its name. */
type InspectFoldName = "components" | "props" | "usage";

/** The frames that Inspect counts, and the Frames filter's state. */
interface InspectFramesState {
  count: number;
  filter: FramesFilterProps;
}

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
} as const satisfies InspectFramesState;

/** The state of a screen's Inspect that an artboard depicts. */
export interface ScreenInspectState<Id extends string> {
  /** The artboard that renders this Inspect. */
  design?: CanvasDestination | undefined;
  /** The instance that the reader selected on a frame; none by default. */
  selected?: Id | undefined;
  /** The folded sections that start unfolded. */
  open?: readonly InspectFoldName[] | undefined;
  /** The section that the panel opens scrolled to. */
  initial?: InspectFoldName | "frames" | "selection" | undefined;
  /** The Frames section: the shown frames, and the filter's state. */
  frames?: InspectFramesState | undefined;
  /** The tag that the search field enters, whose chip the Tags row marks. */
  activeTag?: CatalogueTag | undefined;
}

/** What a screen's Inspect shows of the screen itself. */
interface ScreenInspectSubject<Id extends string> {
  entry: CanvasEntry;
  subject: ScreenSubject;
  variants: readonly InspectVariant[];
  /** The Props section's body, with its field count where it has fields. */
  props: { count?: number | undefined; body: ReactNode };
  /** The registered instances that the screen renders. */
  instances: InstanceRecords<Id>;
}

/**
 * Inspect for a depicted screen: its head and its rationale, its variants
 * and frames, the Selection section with the selected instance, and the
 * folded sections that hold its props, its usage, and its component tree.
 */
export function ScreenInspect<Id extends string>({
  activeTag,
  design,
  entry,
  frames = ALL_FRAMES,
  initial,
  instances,
  open = [],
  props,
  selected,
  subject: id,
  variants,
}: ScreenInspectState<Id> & ScreenInspectSubject<Id>) {
  const subject = SUBJECTS[id];
  const all: readonly CanvasInstance[] = Object.values(instances);
  const roots = all.filter((instance) => instance.parent === undefined);
  return (
    <>
      <InspectHead
        description={subject.description}
        entry={entry}
        rows={<SubjectRows activeTag={activeTag} subject={id} />}
        source={subject.source}
      />
      <InspectRationale noun="screen" text={subject.rationale} />
      <InspectVariants variants={variants} />
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
          instance={instances[selected]}
        />
      )}
      <InspectFold
        count={props.count}
        initial={initial === "props"}
        name="props"
        open={open.includes("props")}
        title="Props"
      >
        {props.body}
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
        count={roots.length}
        initial={initial === "components"}
        name="components"
        open={open.includes("components")}
        title="Components"
      >
        <InstanceComponents
          design={design}
          expanded={open.includes("components")}
          records={instances}
          selected={selected}
        />
      </InspectFold>
    </>
  );
}
