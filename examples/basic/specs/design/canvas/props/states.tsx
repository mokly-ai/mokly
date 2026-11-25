import { defineScreen } from "@mokly/mokly";

import { artboardStates } from "../../parts/artboards.js";

import {
  DefaultStateArtboard,
  type DefaultState,
} from "./parts/default_state.js";
import { PROPS_PAGES as P } from "./parts/destinations.js";
import { propsDesignMetadata, propsState } from "./parts/metadata.js";
import { DEFAULT_EDITS, DEFAULT_SAVED } from "./parts/values.js";

/** The edits while their render is in flight: the frames keep the saved props. */
const PENDING: DefaultState = {
  design: P.propsPending,
  form: "edited",
  values: DEFAULT_EDITS.edited,
  preview: DEFAULT_SAVED,
  pending: true,
};

/** A corner radius outside its bounds, which no render receives. */
const INVALID: DefaultState = {
  design: P.propsInvalid,
  form: "invalid",
  values: DEFAULT_EDITS.invalid,
  preview: DEFAULT_SAVED,
};

/** Values that fail as a whole, which no render receives. */
const TOGETHER: DefaultState = {
  design: P.propsInvalidTogether,
  form: "together",
  values: DEFAULT_EDITS.together,
  preview: DEFAULT_SAVED,
};

/** The edits after their first render failed: the saved props stay. */
const FAILED: DefaultState = {
  design: P.propsError,
  form: "failed",
  values: DEFAULT_EDITS.edited,
  preview: DEFAULT_SAVED,
};

/**
 * Try again of the later edit: its render is in flight, and the frames keep
 * the earlier edit while the fields keep the later one.
 */
const LATER_PENDING: DefaultState = {
  design: P.propsLaterPending,
  form: "pending-later",
  values: DEFAULT_EDITS.later,
  preview: DEFAULT_EDITS.edited,
  pending: true,
};

/**
 * A later edit after the edited props rendered, whose render failed: the
 * frames keep the earlier edit, the last valid props.
 */
const LATER: DefaultState = {
  design: P.propsLaterEdit,
  form: "failed-later",
  values: DEFAULT_EDITS.later,
  preview: DEFAULT_EDITS.edited,
};

/** The edits after Serve discarded their preview: the saved props show. */
const EXPIRED: DefaultState = {
  design: P.propsExpired,
  form: "expired",
  values: DEFAULT_EDITS.edited,
  preview: DEFAULT_SAVED,
};

export const canvasPropsStatesScreen = defineScreen({
  ...propsDesignMetadata,
  description:
    "Edited props of Default while their preview updates: each Default frame keeps its last valid preview, and Updating preview stands at its top. On a phone, the status is a pill at the top of the shown frame, above the open Inspect sheet.",
  ...artboardStates(
    {
      state: "pending",
      title: "Updating preview",
      desktop: <DefaultStateArtboard state={PENDING} viewport="desktop" />,
      mobile: <DefaultStateArtboard state={PENDING} viewport="mobile" />,
    },
    [
      propsState(
        "invalid",
        "Invalid value",
        "Corner radius set to 40, above its maximum of 32: the field keeps the entered value with its error, the alert asks to check the highlighted values, and the frames keep the saved props, because no edit has rendered.",
        (viewport) => (
          <DefaultStateArtboard state={INVALID} viewport={viewport} />
        ),
      ),
      propsState(
        "invalid-together",
        "Values not valid together",
        "Each field holds a valid value, but the props fail as a whole: the alert highlights no field, and Reset to Default is the one way back.",
        (viewport) => (
          <DefaultStateArtboard state={TOGETHER} viewport={viewport} />
        ),
      ),
      propsState(
        "error",
        "Render failed",
        "The first render of the edits failed: the edits stay, the frames keep the saved props, as the alert says, and Try again renders the edits again through Updating preview. Reset to Default stays available.",
        (viewport) => (
          <DefaultStateArtboard state={FAILED} viewport={viewport} />
        ),
      ),
      propsState(
        "later-edit",
        "Later edit failed",
        "The edited props rendered, then a later edit of the label failed: the fields keep the later edit, and the frames keep the earlier edit, the last valid props, as the alert says.",
        (viewport) => (
          <DefaultStateArtboard state={LATER} viewport={viewport} />
        ),
      ),
      propsState(
        "later-pending",
        "Updating the later edit",
        "Try again of the later edit: the later edit renders again, so Updating preview stands at the top of each Default frame, which keeps the earlier edit, the last valid props, and the fields keep the later edit.",
        (viewport) => (
          <DefaultStateArtboard state={LATER_PENDING} viewport={viewport} />
        ),
      ),
      propsState(
        "expired",
        "Preview expired",
        "Serve discarded the temporary preview of the edits: the edits stay, the frames show the saved props, and Update preview renders the edits again through Updating preview.",
        (viewport) => (
          <DefaultStateArtboard state={EXPIRED} viewport={viewport} />
        ),
      ),
    ],
  ),
  slug: "states",
  rationale:
    "An edit never blanks a frame: the last valid preview stays until a render succeeds, and each failure names what failed and offers one way on.",
  title: "Edit states",
});
