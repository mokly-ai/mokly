import {
  UsageList,
  type UsageRow,
} from "../../../../../../../packages/ui/src/usage-list/usage-list.js";
import {
  PendingProps,
  PendingUsage,
  type PendingDetails,
} from "../../loading/parts/details.js";
import { COMPONENT_IDENTITIES } from "../../parts/component_identity.js";
import type { CanvasDestination } from "../../parts/destinations.js";
import { InspectFold, InspectFrames } from "../../parts/inspect.js";
import {
  actionUsedBy,
  instancesOf,
  usageConsumer,
} from "../../parts/inspect_folds.js";
import { InspectFrameSelected } from "../../parts/inspect_selection.js";
import { ComponentHead, SET_FILTER } from "../../parts/inspect_sets.js";
import { InspectVariants } from "../../parts/inspect_variants.js";
import {
  DETAILS_INSTANCES,
  WELCOME_INSTANCES,
} from "../../parts/instance_records.js";
import { actionFrames, frameOf } from "../../parts/set_sketches.js";

import { CHANGED_DEFAULT } from "./branch.js";
import { EXPLORER_PAGES as E } from "./destinations.js";
import {
  DEFAULT_FIELD_COUNT,
  DefaultControls,
  DefaultSavedProps,
} from "./props.js";

/**
 * The screens that the Action branch's change affects, each opening its own
 * Side by side comparison. The contract lists affected screens, so the
 * Toolbar, a component, appears under Used by alone.
 */
function affectedScreens(): UsageRow[] {
  const action = COMPONENT_IDENTITIES.action.title;
  return [
    usageConsumer(
      "Welcome",
      E.explorerAffected,
      instancesOf(WELCOME_INSTANCES, action),
    ),
    usageConsumer(
      "Details",
      E.explorerAffectedDetails,
      instancesOf(DETAILS_INSTANCES, action),
    ),
  ];
}

/**
 * What a state of Default's Inspect shows: its usage in Current, the route's
 * details while its parent's detail loads or after that load failed, or its
 * saved props while a compare mode stays on the frames.
 */
export type DefaultInspectState = "comparison" | "failed" | "loading" | "usage";

/**
 * The route's details in each state that waits for the parent's detail:
 * Default's own detail arrived, and Try again loads the parent's again,
 * which shows them loading.
 */
export const PENDING_DETAILS = {
  loading: { status: "loading" },
  failed: { status: "failed", retry: E.explorerUsageLoading },
} as const satisfies Record<PendingDetails["status"], PendingDetails>;

/**
 * Inspect for the Action's saved variant Default on the Action branch, with
 * its Light frame selected: the Action's head with Default's path and its
 * Changed status, Default checked among the variants, the six frames, and
 * the selected frame. Props edits Default in Current; while a compare mode
 * is on, Props shows its saved props read-only, and Highlight components
 * waits for Current. Usage holds the Action's own lists, Used by and the
 * affected screens, from the parent's detail. A current variant waits for
 * its own detail and its parent's, so until both arrive Props and Usage
 * wait without counts, and no frame mounts, so Highlight components waits
 * for the component preview. After the parent's load failed, Props and
 * Usage say so, and each Try again loads it again. A leaf component has no
 * nested components.
 */
export function DefaultInspect({
  design,
  state,
}: {
  /** The artboard that renders this Inspect. */
  design: CanvasDestination;
  state: DefaultInspectState;
}) {
  const comparing = state === "comparison";
  const details =
    state === "failed" || state === "loading"
      ? PENDING_DETAILS[state]
      : undefined;
  return (
    <>
      <ComponentHead
        component={COMPONENT_IDENTITIES.action}
        entry={CHANGED_DEFAULT}
      />
      <InspectVariants
        variants={[
          { label: "Default", current: true, to: design },
          { label: "Disabled" },
          { label: "Secondary" },
        ]}
      />
      <InspectFrames
        count={6}
        filter={{
          ...SET_FILTER,
          unavailable: comparing
            ? "comparison"
            : details === undefined
              ? "empty"
              : "loading",
        }}
      />
      <InspectFrameSelected
        frame={frameOf(actionFrames(), "default-light")}
        variant="Default"
      />
      <InspectFold
        count={
          comparing || details !== undefined ? undefined : DEFAULT_FIELD_COUNT
        }
        initial={comparing}
        name="props"
        open
        title="Props"
      >
        <DefaultProps comparing={comparing} details={details} />
      </InspectFold>
      <InspectFold
        count={details === undefined ? actionUsedBy().length : undefined}
        initial={!comparing}
        name="usage"
        open={!comparing}
        title="Usage"
      >
        {details === undefined ? (
          <UsageList affected={affectedScreens()} usedBy={actionUsedBy()} />
        ) : (
          <PendingUsage details={details} />
        )}
      </InspectFold>
    </>
  );
}

/**
 * Default's Props: its edit form in Current, its saved props read-only
 * while a compare mode is on, or the shipped status while the route's
 * details are pending.
 */
function DefaultProps({
  comparing,
  details,
}: {
  comparing: boolean;
  details: PendingDetails | undefined;
}) {
  if (details !== undefined) return <PendingProps details={details} />;
  return comparing ? <DefaultSavedProps /> : <DefaultControls />;
}
