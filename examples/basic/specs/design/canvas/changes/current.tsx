import { defineScreen } from "@mokly/mokly";

import { artboards } from "../../parts/artboards.js";
import { WelcomeChangesArtboard } from "../parts/changes_stage.js";
import { canvasChangesMetadata } from "../parts/metadata.js";

export const canvasChangesCurrentScreen = defineScreen({
  ...canvasChangesMetadata,
  description:
    "Welcome on the Changes tab in Current: the frames show the current version, and the right panel shows the change's place among the branch's ten changes, what it compares, the compare modes, and the comparison details. Mokly Cloud adds its check between the stepper and Compared; the open-source panel leaves that place empty. On a phone, the Changes sheet is open with the same tabs, stepper, and modes.",
  ...artboards({
    desktop: <WelcomeChangesArtboard mode="current" viewport="desktop" />,
    mobile: <WelcomeChangesArtboard mode="current" viewport="mobile" />,
  }),
  slug: "current",
  rationale:
    "Changes keeps the canvas as Inspect shows it until the reader picks a mode, and the stepper walks through the branch's changes in the order of the catalogue's Changes filter.",
  title: "Current",
});
