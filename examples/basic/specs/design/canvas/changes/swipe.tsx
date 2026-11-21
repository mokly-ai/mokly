import { defineScreen } from "@mokly/mokly";

import { artboards } from "../../parts/artboards.js";
import { WelcomeChangesArtboard } from "../parts/changes_stage.js";
import { canvasChangesMetadata } from "../parts/metadata.js";

export const canvasChangesSwipeScreen = defineScreen({
  ...canvasChangesMetadata,
  description:
    "Swipe draws one divider at the same place on every frame: the version before to its left and the current version to its right, with a grip and a tag for each. On a phone, the divider crosses the one frame.",
  ...artboards({
    desktop: <WelcomeChangesArtboard mode="swipe" viewport="desktop" />,
    mobile: <WelcomeChangesArtboard mode="swipe" viewport="mobile" />,
  }),
  slug: "swipe",
  rationale:
    "A reader drags the divider across a frame to see where the two versions part, and every frame follows it, so the change reads in each viewport and scheme.",
  title: "Swipe",
});
