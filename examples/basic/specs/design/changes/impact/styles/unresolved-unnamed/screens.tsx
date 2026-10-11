import { defineScreen } from "@mokly/mokly";

import { changesDesignMetadata } from "../../../../metadata.js";
import { DESTINATIONS } from "../../../../parts/destinations.js";
import {
  UnnamedStyleCard,
  UnresolvedStyleCard,
} from "../../../../parts/review.js";
import type { ArtboardViewport } from "../../../../parts/shell.js";
import { StyleComparison } from "../../../../parts/style_comparison.js";

function UnresolvedStyles({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <StyleComparison
      design={DESTINATIONS.styleUnresolved}
      evidence={<UnresolvedStyleCard />}
      viewport={viewport}
    />
  );
}

function UnnamedStyles({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <StyleComparison
      design={DESTINATIONS.styleUnnamed}
      evidence={<UnnamedStyleCard />}
      viewport={viewport}
    />
  );
}

/** A changed rule that can apply anywhere keeps Welcome in Changes. */
export const unresolvedUnnamedDesigns = [
  defineScreen({
    ...changesDesignMetadata,
    colorSchemes: ["light"],
    description:
      "A linked stylesheet changed in a way that could reach any element, so the screen stays in Changes, opens its side-by-side comparison, and Details names the styles the change could reach.",
    desktop: <UnresolvedStyles viewport="desktop" />,
    slug: "unresolved",
    mobile: <UnresolvedStyles viewport="mobile" />,
    title: "Unresolved styles",
  }),
  defineScreen({
    ...changesDesignMetadata,
    colorSchemes: ["light"],
    description:
      "A linked stylesheet changed in a way with no style name to show, so the screen stays in Changes, opens its side-by-side comparison, and Details says the change can apply anywhere with nothing to list.",
    desktop: <UnnamedStyles viewport="desktop" />,
    slug: "unnamed",
    mobile: <UnnamedStyles viewport="mobile" />,
    rationale:
      "A changed rule without a style name, such as an animation or font rule, keeps the screen in Changes with no list to show. The lead sentence therefore ends with a full stop instead of a colon, and the same wording carries both the listed and the unlisted case.",
    title: "Unnamed styles",
  }),
];
