import { InstanceTree } from "../../../../../../../packages/ui/src/instance-tree/instance-tree.js";
import { ScreenControls } from "../../../components/controls/parts/screen_controls.js";
import { SUBJECTS } from "../../../parts/subjects.js";
import { CANVAS_ENTRIES } from "../../parts/entries.js";
import {
  InspectFold,
  InspectFrames,
  InspectHead,
  InspectRationale,
  InspectSelection,
} from "../../parts/inspect.js";
import { SubjectRows } from "../../parts/inspect_entries.js";
import { ScreenInspect } from "../../parts/inspect_screen.js";
import { InspectVariants } from "../../parts/inspect_variants.js";
import { WELCOME_INSTANCES } from "../../parts/instance_records.js";

import { PendingProps, PendingUsage, type PendingDetails } from "./details.js";
import { WELCOME_UNCLASSIFIED, WELCOME_VARIANTS } from "./welcome.js";

/** What the Components section says while the view's records load. */
const WAITING = "Waiting for the component preview.";

/** Welcome's four frames in the Frames filter, with Highlight components off. */
const WELCOME_FILTER = {
  viewports: true,
  mobile: true,
  desktop: true,
  light: true,
  dark: true,
  highlight: false,
} as const;

/**
 * Inspect for Welcome while its stage waits for the entry's detail, or after
 * that detail failed. The catalogue index gives the head, the rationale, the
 * variants, and the frames, so they show at once. Props and Usage wait for
 * the detail. Once it failed, each says so, and its Try again loads the
 * detail again, as the stage's does: it opens the loading stage. The view's
 * usage comes with the detail and no frame mounts without it, so Components
 * and Highlight components wait for the component preview in both states,
 * as the shell's do, and a failed detail never shows the empty view's copy.
 */
export function StageStateInspect({ details }: { details: PendingDetails }) {
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
      <InspectVariants variants={WELCOME_VARIANTS} />
      <InspectFrames
        count={4}
        filter={{ ...WELCOME_FILTER, unavailable: "loading" }}
      />
      <InspectSelection />
      <InspectFold name="props" title="Props">
        <PendingProps details={details} />
      </InspectFold>
      <InspectFold name="usage" title="Usage">
        <PendingUsage details={details} />
      </InspectFold>
      <InspectFold name="components" title="Components">
        <InstanceTree
          usage={{ status: "waiting", text: WAITING }}
          viewport="desktop"
          viewports={[]}
        />
      </InspectFold>
    </>
  );
}

/**
 * Inspect for Welcome while the catalogue holds no comparison result: the
 * same sections as on the canonical branch, under a head that names no
 * change status.
 */
export function UnclassifiedWelcomeInspect() {
  return (
    <ScreenInspect
      entry={WELCOME_UNCLASSIFIED}
      instances={WELCOME_INSTANCES}
      props={{ count: 1, body: <ScreenControls /> }}
      subject="welcome"
      variants={WELCOME_VARIANTS}
    />
  );
}
