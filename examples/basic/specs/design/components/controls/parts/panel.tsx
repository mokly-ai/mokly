import { mockLink } from "@mokly/mokly";

import {
  ControlsPanel as ControlsPanelView,
  SavedPropsPanel,
  type ControlsAlert,
  type ControlsStart,
} from "../../../../../../../packages/ui/src/controls-panel/controls-panel.js";
import { ActionPropValues, actionEntries } from "../../parts/action_props.js";

import { CONTROLS_COPY } from "./copy.js";
import { ControlFields } from "./fields.js";
import {
  controlsFixtures,
  isPublished,
  type ControlsState,
} from "./fixtures.js";

/** The alert of each state that shows one: what failed, and its action. */
const ALERTS: Partial<Record<ControlsState, ControlsAlert>> = {
  error: {
    action: CONTROLS_COPY.retry,
    body: CONTROLS_COPY.failedBody,
    title: CONTROLS_COPY.failedTitle,
  },
  invalid: { text: CONTROLS_COPY.invalid },
  "invalid-together": { text: CONTROLS_COPY.invalidTogether },
  expired: {
    action: CONTROLS_COPY.expiredAction,
    body: CONTROLS_COPY.expiredBody,
    title: CONTROLS_COPY.expiredTitle,
  },
};

/** The start of editing in each state that has not started it. */
const STARTS: Partial<Record<ControlsState, ControlsStart>> = {
  preparing: { status: "preparing", text: CONTROLS_COPY.preparing },
  "preparing-failed": {
    action: CONTROLS_COPY.retry,
    status: "failed",
    text: CONTROLS_COPY.preparingFailed,
  },
};

/**
 * The shipped Props tab of a controls state: the saved props of a comparison
 * or a published catalogue, or else the edit form. A static artboard runs no
 * script, so Reset and each recovery action link to the artboard that shows
 * what it does.
 */
export function ControlsPanel({ state }: { state: ControlsState }) {
  const fixture = controlsFixtures[state];
  const variant = actionEntries[fixture.variant];
  if (isPublished(state) || state === "comparison")
    return (
      <SavedPropsPanel
        {...(state === "comparison"
          ? {
              current: CONTROLS_COPY.switchToCurrent,
              currentHref: mockLink(
                "design/components/controls/controls/default",
              ),
            }
          : {})}
        heading={CONTROLS_COPY.readonlyHeading}
        notice={
          state === "comparison"
            ? CONTROLS_COPY.comparison
            : CONTROLS_COPY.published
        }
        title={variant.title}
      >
        <ActionPropValues props={fixture.draft} />
      </SavedPropsPanel>
    );
  return (
    <ControlsPanelView
      alert={ALERTS[state]}
      dirty={fixture.edited}
      resetHref={mockLink("design/components/controls/editing/reset")}
      restored={state === "reset" ? CONTROLS_COPY.restored : undefined}
      retryHref={mockLink("design/components/controls/states/pending")}
      start={STARTS[state]}
      startHref={mockLink("design/components/controls/states/preparing")}
      title={variant.title}
      wording={{
        edited: CONTROLS_COPY.edited,
        heading: CONTROLS_COPY.heading,
        reset: CONTROLS_COPY.reset(variant.title),
        saved: CONTROLS_COPY.saved,
      }}
    >
      <ControlFields props={fixture.draft} invalid={state === "invalid"} />
    </ControlsPanelView>
  );
}
