import { defineScreen } from "@mokly/mokly";

import { artboards } from "../../parts/artboards.js";
import { WelcomeChangesArtboard } from "../parts/changes_stage.js";
import { canvasChangesMetadata } from "../parts/metadata.js";

export const canvasChangesOverlayScreen = defineScreen({
  ...canvasChangesMetadata,
  description:
    "Overlay compares every frame in place: the current version at half strength over the version before. On a phone, the one frame shows the overlay.",
  ...artboards({
    desktop: <WelcomeChangesArtboard mode="overlay" viewport="desktop" />,
    mobile: <WelcomeChangesArtboard mode="overlay" viewport="mobile" />,
  }),
  slug: "overlay",
  rationale:
    "Both versions share each frame, so a change reads where the versions part, in every viewport and scheme at once.",
  title: "Overlay",
});
