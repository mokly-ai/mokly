import { defineScreen } from "@mokly/mokly";

import { artboardStates } from "../../parts/artboards.js";

import {
  DefaultStateArtboard,
  type DefaultState,
} from "./parts/default_state.js";
import { PROPS_PAGES as P } from "./parts/destinations.js";
import { propsDesignMetadata, propsState } from "./parts/metadata.js";
import { DEFAULT_EDITS, DEFAULT_SAVED } from "./parts/values.js";

/** Default chosen with its saved props, before any edit. */
const SAVED: DefaultState = {
  design: P.propsEditing,
  form: "saved",
  values: DEFAULT_SAVED,
  preview: DEFAULT_SAVED,
};

/** Label, Corner radius, and Emphasis edited, and rendered. */
const EDITED: DefaultState = {
  design: P.propsEdited,
  form: "edited",
  values: DEFAULT_EDITS.edited,
  preview: DEFAULT_EDITS.edited,
};

/** The optional hint unset, and rendered without it. */
const UNSET: DefaultState = {
  design: P.propsUnset,
  form: "edited",
  values: DEFAULT_EDITS.unset,
  preview: DEFAULT_EDITS.unset,
};

/** After Reset: the saved props are back. */
const RESET: DefaultState = {
  design: P.propsReset,
  form: "restored",
  values: DEFAULT_SAVED,
  preview: DEFAULT_SAVED,
};

export const canvasPropsEditingScreen = defineScreen({
  ...propsDesignMetadata,
  description:
    "The Action's variant set with Default chosen: its Light frame is selected, and Inspect's Props section edits Default with each control type, text, a toggle, a number, a select, and optional props. Reset stays off until a prop changes. On a phone, the frame picker shows Default · Light under the open Inspect sheet.",
  ...artboardStates(
    {
      state: "default",
      title: "Default chosen",
      desktop: <DefaultStateArtboard state={SAVED} viewport="desktop" />,
      mobile: <DefaultStateArtboard state={SAVED} viewport="mobile" />,
    },
    [
      propsState(
        "edited",
        "Edited props",
        "Label, Corner radius, and Emphasis edited: Props names the edited props, Reset to Default opens the restored state, and both Default frames render the edits, while Disabled and Secondary keep their saved props.",
        (viewport) => (
          <DefaultStateArtboard state={EDITED} viewport={viewport} />
        ),
      ),
      propsState(
        "unset",
        "Optional prop unset",
        "The optional Hint unset with its Set check box: the field reads Not set, which differs from an empty hint, and the Default frames render the Action without its hint.",
        (viewport) => (
          <DefaultStateArtboard state={UNSET} viewport={viewport} />
        ),
      ),
      propsState(
        "reset",
        "Saved props restored",
        "After Reset: Default's saved props are back in the fields and on both Default frames, the status says so, and Reset is off again.",
        (viewport) => (
          <DefaultStateArtboard state={RESET} viewport={viewport} />
        ),
      ),
    ],
  ),
  slug: "editing",
  rationale:
    "Props edits one saved variant at a time, the variant of the selected frame, so a reader tries a state of that variant in place, and Reset returns to its saved props. Edits never change a source file or create a saved variant.",
  title: "Editing",
});
