import { defineScreen } from "@mokly/mokly";

import { artboardStates } from "../../parts/artboards.js";

import {
  DefaultStateArtboard,
  type DefaultState,
} from "./parts/default_state.js";
import { PROPS_PAGES as P } from "./parts/destinations.js";
import { propsDesignMetadata, propsState } from "./parts/metadata.js";
import { DEFAULT_SAVED } from "./parts/values.js";

/** Default's saved props in read-only fields while editing starts. */
const PREPARING: DefaultState = {
  design: P.propsPreparing,
  form: "preparing",
  values: DEFAULT_SAVED,
  preview: DEFAULT_SAVED,
};

/** The same fields after editing could not start. */
const FAILED: DefaultState = {
  design: P.propsPreparingFailed,
  form: "preparing-failed",
  values: DEFAULT_SAVED,
  preview: DEFAULT_SAVED,
};

export const canvasPropsPreparingScreen = defineScreen({
  ...propsDesignMetadata,
  description:
    "Until local Serve installs editing, Props shows Default's saved props in read-only fields under Preparing to edit props…. Browsing keeps working, and a later refresh keeps editing available once it starts.",
  ...artboardStates(
    {
      state: "preparing",
      title: "Preparing to edit",
      desktop: <DefaultStateArtboard state={PREPARING} viewport="desktop" />,
      mobile: <DefaultStateArtboard state={PREPARING} viewport="mobile" />,
    },
    [
      propsState(
        "failed",
        "Editing could not start",
        "Editing could not start: the saved props stay readable in read-only fields, browsing keeps working, and Try again asks Serve again, which opens Preparing to edit.",
        (viewport) => (
          <DefaultStateArtboard state={FAILED} viewport={viewport} />
        ),
      ),
    ],
  ),
  slug: "preparing",
  rationale:
    "The fields hold their place while editing starts, so they never move when they turn editable, and a failed start keeps every saved value readable.",
  title: "Preparing to edit",
});
