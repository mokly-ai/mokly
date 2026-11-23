import type { ReactNode } from "react";

import { ComparisonEvidence } from "../../../../../../../packages/ui/src/comparison-evidence/comparison-evidence.js";
import { NoPropsPanel } from "../../../components/controls/parts/limits.js";
import { ScreenControls } from "../../../components/controls/parts/screen_controls.js";
import { SUBJECTS, type ScreenSubject } from "../../../parts/subjects.js";
import type { CanvasEntry } from "../../parts/entries.js";
import {
  InspectFold,
  InspectFrames,
  InspectHead,
  InspectRationale,
  InspectSelection,
} from "../../parts/inspect.js";
import { SubjectRows } from "../../parts/inspect_entries.js";
import { InstanceComponents, ScreenUsage } from "../../parts/inspect_folds.js";
import { InspectVariants } from "../../parts/inspect_variants.js";
import {
  DETAILS_INSTANCES,
  WELCOME_INSTANCES,
} from "../../parts/instance_records.js";
import type { CanvasInstance, InstanceRecords } from "../../parts/instances.js";

import { EVIDENCE_ENTRIES } from "./branches.js";
import {
  EXCLUDED_ONLY_STYLES,
  IGNORED_CONTENT,
  type EvidenceFacts,
} from "./evidence.js";

/**
 * The comparison evidence that an entry without Changes keeps in Inspect,
 * right after the head, as the shipped evidence draws it. No Compared rail
 * names the base in Inspect, so the evidence keeps its branch-point
 * sentence. The panel opens at its top, so the head and the evidence show
 * together.
 */
export function InspectEvidence({ facts }: { facts: EvidenceFacts }) {
  return (
    <div className="cv-sec cv-evidence cv-ev-inspect">
      <ComparisonEvidence
        base="origin/main"
        mark="data-workspace-evidence"
        {...facts}
      />
    </div>
  );
}

/** A screen's four frames in the Frames filter, with Highlight components off. */
const SCREEN_FRAMES = {
  viewports: true,
  mobile: true,
  desktop: true,
  light: true,
  dark: true,
  highlight: false,
} as const;

/**
 * Inspect for a screen without Changes: its head, then the comparison
 * evidence that it keeps, then its rationale, its variants and frames, the
 * Selection section, and the folded sections of its props, its usage, and
 * its component tree. Each instance of the tree opens the artboard that
 * shows it selected.
 */
function ScreenEvidenceInspect<Id extends string>({
  entry,
  facts,
  instances,
  props,
  subject: id,
  variants,
}: {
  entry: CanvasEntry;
  facts: EvidenceFacts;
  instances: InstanceRecords<Id>;
  /** The Props section's body, with its field count where it has fields. */
  props: { count?: number | undefined; body: ReactNode };
  subject: ScreenSubject;
  /** The screen's saved variants, the shown one first. */
  variants: readonly string[];
}) {
  const subject = SUBJECTS[id];
  const all: readonly CanvasInstance[] = Object.values(instances);
  const roots = all.filter((instance) => instance.parent === undefined);
  return (
    <>
      <InspectHead
        description={subject.description}
        entry={entry}
        rows={<SubjectRows subject={id} />}
        source={subject.source}
      />
      <InspectEvidence facts={facts} />
      <InspectRationale noun="screen" text={subject.rationale} />
      <InspectVariants
        variants={variants.map((label, index) => ({
          label,
          current: index === 0,
        }))}
      />
      <InspectFrames count={4} filter={SCREEN_FRAMES} />
      <InspectSelection />
      <InspectFold count={props.count} name="props" title="Props">
        {props.body}
      </InspectFold>
      <InspectFold name="usage" title="Usage">
        <ScreenUsage />
      </InspectFold>
      <InspectFold count={roots.length} name="components" title="Components">
        <InstanceComponents records={instances} />
      </InspectFold>
    </>
  );
}

/**
 * Inspect for Details on the styles branch: it links only the stylesheet
 * whose changed styles apply nowhere on it, so it keeps that evidence, which
 * ends with the line of a screen without changes.
 */
export function ExcludedOnlyInspect() {
  return (
    <ScreenEvidenceInspect
      entry={EVIDENCE_ENTRIES.details}
      facts={EXCLUDED_ONLY_STYLES}
      instances={DETAILS_INSTANCES}
      props={{ body: <NoPropsPanel /> }}
      subject="details"
      variants={["Details"]}
    />
  );
}

/**
 * Inspect for Welcome on the excluded content branch: its only differences
 * lie in its navigation, which the comparison leaves out, so it keeps that
 * evidence and the line of a screen without changes.
 */
export function IgnoredInspect() {
  return (
    <ScreenEvidenceInspect
      entry={EVIDENCE_ENTRIES.welcome}
      facts={IGNORED_CONTENT}
      instances={WELCOME_INSTANCES}
      props={{ count: 1, body: <ScreenControls /> }}
      subject="welcome"
      variants={["Welcome", "Empty workspace", "Save failed"]}
    />
  );
}
