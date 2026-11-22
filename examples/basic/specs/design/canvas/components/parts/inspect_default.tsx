import {
  UsageList,
  UsageStatus,
  type UsageRow,
} from "../../../../../../../packages/ui/src/usage-list/usage-list.js";
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
 * What a state of Default's Inspect shows: its usage in Current, its usage
 * while its parent's detail loads, or its saved props while a compare mode
 * stays on the frames.
 */
export type DefaultInspectState = "comparison" | "loading" | "usage";

/**
 * Inspect for the Action's saved variant Default on the Action branch, with
 * its Light frame selected: the Action's head with Default's path and its
 * Changed status, Default checked among the variants, the six frames, and
 * the selected frame. Props edits Default in Current; while a compare mode
 * is on, Props shows its saved props read-only, and Highlight components
 * waits for Current. Usage holds the Action's own lists, Used by and the
 * affected screens, from the parent's detail, which a loading state still
 * waits for. A leaf component has no nested components.
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
          unavailable: comparing ? "comparison" : "empty",
        }}
      />
      <InspectFrameSelected
        frame={frameOf(actionFrames(), "default-light")}
        variant="Default"
      />
      <InspectFold
        count={comparing ? undefined : DEFAULT_FIELD_COUNT}
        initial={comparing}
        name="props"
        open
        title="Props"
      >
        {comparing ? <DefaultSavedProps /> : <DefaultControls />}
      </InspectFold>
      <InspectFold
        count={state === "loading" ? undefined : actionUsedBy().length}
        initial={!comparing}
        name="usage"
        open={!comparing}
        title="Usage"
      >
        {state === "loading" ? (
          <UsageStatus status="loading" />
        ) : (
          <UsageList affected={affectedScreens()} usedBy={actionUsedBy()} />
        )}
      </InspectFold>
    </>
  );
}
