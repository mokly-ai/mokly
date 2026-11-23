import { mockLink } from "@mokly/mokly";

import { InstanceTree } from "../../../../../../../packages/ui/src/instance-tree/instance-tree.js";
import { PropsMessage } from "../../../../../../../packages/ui/src/props-panel/props-panel.js";
import {
  UsageList,
  UsageStatus,
  type UsageRow,
} from "../../../../../../../packages/ui/src/usage-list/usage-list.js";
import { CONTROLS_COPY } from "../../../components/controls/parts/copy.js";
import { SUBJECTS } from "../../../parts/subjects.js";
import { COMPONENT_IDENTITIES } from "../../parts/component_identity.js";
import { CANVAS_ENTRIES } from "../../parts/entries.js";
import {
  InspectFold,
  InspectFrames,
  InspectHead,
  InspectRationale,
  InspectSelection,
} from "../../parts/inspect.js";
import { SubjectRows } from "../../parts/inspect_entries.js";
import { ScreenUsage, actionUsedBy } from "../../parts/inspect_folds.js";
import { InspectFrameSelected } from "../../parts/inspect_selection.js";
import { ComponentHead, SET_FILTER } from "../../parts/inspect_sets.js";
import { InspectVariants } from "../../parts/inspect_variants.js";
import { frameOf } from "../../parts/set_sketches.js";

import { REMOVED_COMPACT } from "./branch.js";
import { EXPLORER_PAGES as E } from "./destinations.js";
import { CompactSavedProps } from "./props.js";
import { removedSetFrames } from "./sketches.js";

/**
 * Farewell, a former consumer of the Action that the removal branch removed,
 * in the affected list: it rendered one Action in each of its two Light
 * views, and its row opens its Removed state, which shows its previous
 * version.
 */
function removedConsumer(): UsageRow {
  return {
    direct: true,
    href: mockLink(E.explorerConsumer),
    id: "Farewell",
    instances: 1,
    key: "Farewell",
    removed: true,
    title: "Farewell",
    views: 2,
  };
}

/**
 * Inspect for the removed Compact on its parent's variant set, with its
 * Light frame selected: the Action's head with Compact's path and its
 * Removed status, the Action itself and its current variants with Compact
 * checked after them, the ten frames, and the selected frame. Props shows Compact's saved props
 * read-only. A removed variant keeps its own lists: the consumers of the
 * Action, and the screens that the change affects, which keep Farewell, a
 * removed former consumer. Removing a saved variant changes no current
 * consumer's render, so Welcome and Details stay out of that list.
 */
export function RemovedInspect() {
  return (
    <>
      <ComponentHead
        component={COMPONENT_IDENTITIES.action}
        entry={REMOVED_COMPACT}
      />
      <InspectVariants
        variants={[
          { label: COMPONENT_IDENTITIES.action.title },
          { label: "Default" },
          { label: "Disabled" },
          { label: "Secondary" },
          {
            label: "Compact · Removed",
            current: true,
            to: E.explorerRemoved,
          },
        ]}
      />
      <InspectFrames
        count={10}
        filter={{ ...SET_FILTER, unavailable: "empty" }}
      />
      <InspectFrameSelected
        frame={frameOf(removedSetFrames(), "compact-light")}
        initial
        variant="Compact"
      />
      <InspectFold name="props" title="Props">
        <CompactSavedProps />
      </InspectFold>
      <InspectFold count={actionUsedBy().length} name="usage" title="Usage">
        <UsageList affected={[removedConsumer()]} usedBy={actionUsedBy()} />
      </InspectFold>
    </>
  );
}

/** The shell's line while a view's component preview loads. */
const WAITING = "Waiting for the component preview.";

/** A state of Details' screen inspection. */
export type InspectionState = "unavailable" | "waiting";

/**
 * Inspect for Details while its view's usage is not ready: waiting until
 * the frame adopts it, or unavailable because the view has no inspection
 * metadata. The Components section and the Highlight components switch say
 * which, and never claim an empty list. Details supplies no props of its
 * own, so Props waits too, or says that props are unavailable. Its own
 * usage has arrived while it waits; without inspection metadata, the
 * catalogue has not been checked.
 */
export function InspectionInspect({ state }: { state: InspectionState }) {
  const subject = SUBJECTS.details;
  const waiting = state === "waiting";
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
          unavailable: waiting ? "loading" : "unavailable",
        }}
      />
      <InspectSelection />
      <InspectFold name="props" title="Props">
        <PropsMessage pending={waiting}>
          {waiting ? WAITING : CONTROLS_COPY.propsUnavailable}
        </PropsMessage>
      </InspectFold>
      <InspectFold name="usage" title="Usage">
        {waiting ? <ScreenUsage /> : <UsageStatus status="unchecked" />}
      </InspectFold>
      <InspectFold initial name="components" open title="Components">
        <InstanceTree
          usage={
            waiting
              ? { status: "waiting", text: WAITING }
              : { status: "unavailable" }
          }
          viewport="mobile"
          viewports={[]}
        />
      </InspectFold>
    </>
  );
}
