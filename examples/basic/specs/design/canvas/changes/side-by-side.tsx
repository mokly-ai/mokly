import { defineScreen } from "@mokly/mokly";

import { artboards } from "../../parts/artboards.js";
import { WelcomeChangesArtboard } from "../parts/changes_stage.js";
import { canvasChangesMetadata } from "../parts/metadata.js";

export const canvasChangesSideBySideScreen = defineScreen({
  ...canvasChangesMetadata,
  description:
    "Side by side compares one frame, which the frame chips choose: the version before beside the current version of Desktop · Light. On a phone, the two versions of Mobile · Light stand side by side, and the frame picker shows another frame's pair.",
  ...artboards({
    desktop: <WelcomeChangesArtboard mode="side-by-side" viewport="desktop" />,
    mobile: <WelcomeChangesArtboard mode="side-by-side" viewport="mobile" />,
  }),
  slug: "side-by-side",
  rationale:
    "Eight frames do not fit a readable zoom, so Side by side compares one frame at a time, at the largest zoom that fits both of its versions.",
  title: "Side by side",
});
