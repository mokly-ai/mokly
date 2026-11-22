import { InstanceTree } from "../../../../../../../packages/ui/src/instance-tree/instance-tree.js";
import { PropsStatus } from "../../../../../../../packages/ui/src/props-panel/props-panel.js";
import { UsageStatus } from "../../../../../../../packages/ui/src/usage-list/usage-list.js";
import { CONTROLS_COPY } from "../../../components/controls/parts/copy.js";
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

import { WELCOME_UNCLASSIFIED, WELCOME_VARIANTS } from "./welcome.js";

/** The settled wording of the Props tab while its data loads. */
const PROPS_WORDING = {
  failed: CONTROLS_COPY.loadFailed,
  loading: CONTROLS_COPY.loading,
  retry: CONTROLS_COPY.retry,
} as const;

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
 * variants, and the frames, so they show at once; the Frames filter
 * disables Highlight components with the shell's reason. While the detail
 * loads, the folded sections hold their loading states. Once it failed, they
 * stay closed without a body: the stage holds the one Try again that this
 * static artboard draws.
 */
export function StageStateInspect({ state }: { state: "failed" | "loading" }) {
  const subject = SUBJECTS.welcome;
  const loading = state === "loading";
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
        filter={{ ...WELCOME_FILTER, unavailable: state }}
      />
      <InspectSelection />
      <InspectFold name="props" title="Props">
        {loading ? (
          <PropsStatus status="loading" wording={PROPS_WORDING} />
        ) : undefined}
      </InspectFold>
      <InspectFold name="usage" title="Usage">
        {loading ? <UsageStatus status="loading" /> : undefined}
      </InspectFold>
      <InspectFold name="components" title="Components">
        {loading ? (
          <InstanceTree
            usage={{ status: "waiting", text: WAITING }}
            viewport="desktop"
            viewports={[]}
          />
        ) : undefined}
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
