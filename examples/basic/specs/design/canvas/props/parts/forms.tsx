import { mockLink } from "@mokly/mokly";

import { SavedPropsPanel } from "../../../../../../../packages/ui/src/controls-panel/controls-panel.js";
import {
  PropsStatus,
  PropValues,
} from "../../../../../../../packages/ui/src/props-panel/props-panel.js";
import { CONTROLS_COPY } from "../../../components/controls/parts/copy.js";
import {
  actionFields,
  VariantControls,
  type ActionValues,
  type VariantEdit,
} from "../../parts/component_props.js";

import { PROPS_PAGES } from "./destinations.js";

/** The state of Default's edit form in each depicted state of an edit. */
export type EditState =
  | "saved"
  | "edited"
  | "restored"
  | "invalid"
  | "together"
  | "failed"
  | "expired"
  | "preparing"
  | "preparing-failed";

/**
 * The form's state in each depicted state, with the copy of the shipped
 * Props controls. Edited props draw their badge, and Reset opens the
 * restored state. The action of a failed or an expired render renders the
 * edits again, through the pending state, and Try again of a failed start
 * asks Serve again, through the preparing state.
 */
function editOf(state: EditState): VariantEdit {
  const edited = { dirty: true, resetHref: mockLink(PROPS_PAGES.propsReset) };
  const rerender = { ...edited, retryHref: mockLink(PROPS_PAGES.propsPending) };
  switch (state) {
    case "saved":
      return {};
    case "edited":
      return edited;
    case "restored":
      return { restored: CONTROLS_COPY.restored };
    case "invalid":
      return { ...edited, alert: { text: CONTROLS_COPY.invalid } };
    case "together":
      return { ...edited, alert: { text: CONTROLS_COPY.invalidTogether } };
    case "failed":
      return {
        ...rerender,
        alert: {
          action: CONTROLS_COPY.retry,
          body: CONTROLS_COPY.failedBody,
          title: CONTROLS_COPY.failedTitle,
        },
      };
    case "expired":
      return {
        ...rerender,
        alert: {
          action: CONTROLS_COPY.expiredAction,
          body: CONTROLS_COPY.expiredBody,
          title: CONTROLS_COPY.expiredTitle,
        },
      };
    case "preparing":
      return { start: { status: "preparing", text: CONTROLS_COPY.preparing } };
    case "preparing-failed":
      return {
        start: {
          action: CONTROLS_COPY.retry,
          status: "failed",
          text: CONTROLS_COPY.preparingFailed,
        },
        startHref: mockLink(PROPS_PAGES.propsPreparing),
      };
  }
}

/**
 * Default's edit form in one state of an edit: the shipped form with the
 * Action's controls holding the given values, a corner radius outside its
 * bounds marked with its error.
 */
export function DefaultEditForm({
  state,
  values,
}: {
  state: EditState;
  values: ActionValues;
}) {
  return (
    <VariantControls
      edit={editOf(state)}
      fields={actionFields(values, { radius: state === "invalid" })}
      id="action-default"
      title="Default"
    />
  );
}

/** The Action's props in the order of its controls. */
const ACTION_PROPS = [
  "label",
  "disabled",
  "radius",
  "tone",
  "hint",
] as const satisfies readonly (keyof ActionValues)[];

/** A saved value as the shipped panel words it: JSON text, or Not set. */
function valueText(value: boolean | number | string | undefined): string {
  if (value === undefined) return CONTROLS_COPY.notSet;
  return typeof value === "string" ? JSON.stringify(value) : String(value);
}

/**
 * The saved props of a variant in a static build: the shipped saved-props
 * panel with each prop in the order of the controls, and the secondary line
 * that says where props can be edited.
 */
export function PublishedProps({
  title,
  values,
}: {
  title: string;
  values: ActionValues;
}) {
  return (
    <SavedPropsPanel
      heading={CONTROLS_COPY.readonlyHeading}
      notice={CONTROLS_COPY.published}
      title={title}
    >
      <PropValues
        values={ACTION_PROPS.map((name) => ({
          name,
          value: valueText(values[name]),
        }))}
      />
    </SavedPropsPanel>
  );
}

/** The number of props that the published panel lists. */
export const PUBLISHED_COUNT = ACTION_PROPS.length;

/**
 * The shipped Props status while the route's details load: the fields wait
 * for the details, which alone carry their declared order.
 */
export function LoadingProps() {
  return (
    <PropsStatus
      status="loading"
      wording={{
        failed: CONTROLS_COPY.loadFailed,
        loading: CONTROLS_COPY.loading,
        retry: CONTROLS_COPY.retry,
      }}
    />
  );
}
