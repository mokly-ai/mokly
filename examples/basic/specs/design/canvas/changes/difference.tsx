import { defineScreen } from "@mokly/mokly";

import { artboards } from "../../parts/artboards.js";
import { WelcomeChangesArtboard } from "../parts/changes_stage.js";
import { canvasChangesMetadata } from "../parts/metadata.js";

export const canvasChangesDifferenceScreen = defineScreen({
  ...canvasChangesMetadata,
  description:
    "Difference blends the current version with the version before on every frame, so what stayed the same turns dark and what changed stands out. On a phone, the one frame shows the blend.",
  ...artboards({
    desktop: <WelcomeChangesArtboard mode="difference" viewport="desktop" />,
    mobile: <WelcomeChangesArtboard mode="difference" viewport="mobile" />,
  }),
  slug: "difference",
  rationale:
    "A small change, such as a moved line or a new word, is easy to miss between two versions; the blend leaves only the change in light.",
  title: "Difference",
});
