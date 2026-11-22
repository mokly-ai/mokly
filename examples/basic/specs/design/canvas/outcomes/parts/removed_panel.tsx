import { optional, useDesignInstance } from "../../../library/composition.js";
import { changeStepper } from "../../../library/panels/change-stepper.js";
import { MetaRow } from "../../../parts/metadata_row.js";
import { TagChips } from "../../../parts/tag_filter.js";
import { ChangesCompared, ChangesEvidence } from "../../parts/changes.js";
import type { CanvasDestination } from "../../parts/destinations.js";
import {
  InspectFrames,
  InspectHead,
  InspectRationale,
} from "../../parts/inspect.js";
import {
  InspectVariants,
  type InspectVariant,
} from "../../parts/inspect_variants.js";

import type { RemovedRecord } from "./removed_entries.js";

/** A removed entry's place among the changes that the Changes filter lists. */
export interface RemovedStep {
  position: number;
  total: number;
  /** The neighbouring change on its Changes tab, where an artboard shows it. */
  previous?: CanvasDestination | undefined;
  next?: CanvasDestination | undefined;
}

/**
 * The Changes tab of a removed entry: the stepper, whose Previous change and
 * Next change reach the neighbouring changes, removed ones included; the
 * Compared rail, which holds the version before alone; and the comparison
 * details with the sentence of its reason. A removed entry offers no compare
 * mode, not even Current, and no Refresh, so the tab holds no Compare
 * section. The cloud's check stands after the stepper; the open-source panel
 * leaves that place empty.
 */
export function RemovedChanges({ step }: { step: RemovedStep }) {
  return (
    <>
      <changeStepper.Component
        moklyInstance={useDesignInstance("stepper")}
        position={step.position}
        total={step.total}
        {...optional("previousDestination", step.previous)}
        {...optional("nextDestination", step.next)}
      />
      <ChangesCompared removed />
      <ChangesEvidence reasons={["removed"]} />
    </>
  );
}

/**
 * The Details rows of a removed entry's base-commit record after its path
 * and source, as the shell's Details show them: a screen's schemes, the
 * folders that held the entry, which stand for its breadcrumbs, and its
 * tags, which a removed entry offers as pictures.
 */
function RemovedRows({ record }: { record: RemovedRecord }) {
  return (
    <>
      {record.entry.kind === "screen" ? (
        <MetaRow name="schemes" label="Schemes">
          {record.schemes}
        </MetaRow>
      ) : null}
      <MetaRow name="location" label="Location">
        {record.location}
      </MetaRow>
      {record.tags?.length ? (
        <MetaRow name="tags" label="Tags">
          <TagChips tags={record.tags} />
        </MetaRow>
      ) : null}
    </>
  );
}

/** The head of a removed entry's Inspect: its title, status and record. */
function RemovedHead({ record }: { record: RemovedRecord }) {
  return (
    <InspectHead
      description={record.description}
      entry={record.entry}
      rows={<RemovedRows record={record} />}
      source={record.source}
    />
  );
}

/** A removed page's or document's Inspect, which holds its head alone. */
export function RemovedDocumentInspect({ record }: { record: RemovedRecord }) {
  return <RemovedHead record={record} />;
}

/**
 * A removed screen's Inspect: its head, its rationale, its variants, and the
 * Frames filter of its historical frames, whose Highlight components switch
 * is unavailable, because no current preview exists to inspect. A previous
 * version has no current bindings, props or usage, so Inspect holds no
 * Selection, Props, Usage or Components section. A screen whose views are
 * light only disables the Dark toggle, which reads Light only.
 */
export function RemovedScreenInspect({
  frames,
  record,
  variants = [{ label: record.entry.title, current: true }],
}: {
  /** The count of the shown frames, and the view without a dark render. */
  frames: { count: number; lightOnly: boolean };
  record: RemovedRecord;
  variants?: readonly InspectVariant[];
}) {
  return (
    <>
      <RemovedHead record={record} />
      {record.rationale === undefined ? null : (
        <InspectRationale noun="screen" text={record.rationale} />
      )}
      <InspectVariants variants={variants} />
      <InspectFrames
        count={frames.count}
        filter={{
          viewports: true,
          mobile: true,
          desktop: true,
          light: true,
          dark: !frames.lightOnly,
          lightOnly: frames.lightOnly,
          highlight: false,
          unavailable: "removed",
        }}
      />
    </>
  );
}
