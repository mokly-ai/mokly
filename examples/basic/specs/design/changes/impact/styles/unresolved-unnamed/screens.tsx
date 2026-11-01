import { defineScreen } from "@mokly/mokly";

import { changesDesignMetadata } from "../../../../metadata.js";
import { artboards } from "../../../../parts/artboards.js";
import { DESTINATIONS } from "../../../../parts/destinations.js";
import { UNNAMED_STYLES, UNRESOLVED_STYLES } from "../../../../parts/review.js";
import type { ArtboardViewport } from "../../../../parts/shell.js";
import { StyleComparison } from "../../../../parts/style_comparison.js";

function UnresolvedStyles({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <StyleComparison
      design={DESTINATIONS.styleUnresolved}
      evidence={UNRESOLVED_STYLES}
      viewport={viewport}
    />
  );
}

function UnnamedStyles({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <StyleComparison
      design={DESTINATIONS.styleUnnamed}
      evidence={UNNAMED_STYLES}
      viewport={viewport}
    />
  );
}

/** A changed rule that can apply anywhere keeps Welcome in Changes. */
export const unresolvedScreen = defineScreen({
  ...changesDesignMetadata,
  colorSchemes: ["light"],
  description:
    "A linked stylesheet changed in a way that could reach any element, so the screen stays in Changes, opens its side-by-side comparison, and Details names the styles the change could reach.",
  ...artboards({
    desktop: <UnresolvedStyles viewport="desktop" />,
    mobile: <UnresolvedStyles viewport="mobile" />,
  }),
  slug: "unresolved",
  title: "Unresolved styles",
});
export const unnamedScreen = defineScreen({
  ...changesDesignMetadata,
  colorSchemes: ["light"],
  description:
    "A linked stylesheet changed in a way with no style name to show, so the screen stays in Changes, opens its side-by-side comparison, and Details says the change can apply anywhere with nothing to list.",
  ...artboards({
    desktop: <UnnamedStyles viewport="desktop" />,
    mobile: <UnnamedStyles viewport="mobile" />,
  }),
  slug: "unnamed",
  rationale:
    "A changed rule without a style name, such as an animation or font rule, keeps the screen in Changes with no list to show. The lead sentence therefore ends with a full stop instead of a colon, and the same wording carries both the listed and the unlisted case.",
  title: "Unnamed styles",
});
