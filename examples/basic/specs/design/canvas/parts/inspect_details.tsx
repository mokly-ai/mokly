import { NoPropsPanel } from "../../components/controls/parts/limits.js";
import { SUBJECTS } from "../../parts/subjects.js";

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
import { ScreenUsage } from "./inspect_folds.js";

/**
 * Inspect for Details, which the canonical branch added: a screen in both
 * schemes with no saved variant and no props, which renders the Action and
 * the Toolbar, so Highlight components is available. No Canvas artboard
 * shows one of its instances selected, so its component tree keeps its
 * count and stays folded.
 */
export function DetailsInspect() {
  const subject = SUBJECTS.details;
  return (
    <>
      <InspectHead
        description={subject.description}
        entry={CANVAS_ENTRIES.details}
        rows={<SubjectRows subject="details" />}
        source={subject.source}
      />
      <InspectRationale noun="screen" text={subject.rationale} />
      <InspectVariants variants={[{ label: "Details", current: true }]} />
      <InspectFrames
        count={4}
        filter={{
          viewports: true,
          mobile: true,
          desktop: true,
          light: true,
          dark: true,
          highlight: false,
        }}
      />
      <InspectSelection />
      <InspectFold name="props" title="Props">
        <NoPropsPanel />
      </InspectFold>
      <InspectFold name="usage" title="Usage">
        <ScreenUsage />
      </InspectFold>
      <InspectFold count={2} name="components" title="Components" />
    </>
  );
}
