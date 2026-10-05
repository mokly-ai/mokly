import { folder, screen } from "@mokly/mokly";

import { DESTINATIONS } from "./parts/destinations.js";
import {
  HandbookStage,
  PAGE_STYLE_COUNT,
  PAGE_STYLE_ROWS,
  PageDetails,
} from "./parts/document_page.js";
import { NavTree } from "./parts/nav.js";
import { PageStyleCard } from "./parts/review.js";
import { ScreenHead, Shell, type ArtboardViewport } from "./parts/shell.js";
import { matchedExcludedDesigns } from "./review/impact/stylesheets/matched-excluded/screens.js";
import { unresolvedUnnamedDesigns } from "./review/impact/stylesheets/unresolved-unnamed/screens.js";

/**
 * A changed document opened from Changes. A whole document has no comparison
 * controls, so its Details carry the stylesheet evidence with the page copy.
 */
function PageStyles({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <Shell
      design={DESTINATIONS.stylePage}
      viewport={viewport}
      nav={
        <NavTree
          activeDestination={DESTINATIONS.stylePage}
          changedCount={PAGE_STYLE_COUNT}
          changedOnly
          nodes={PAGE_STYLE_ROWS}
        />
      }
    >
      <ScreenHead
        comparisons={false}
        crumbs={["Example"]}
        idChip="example-handbook"
        status="changed"
        title="Getting started"
      />
      <HandbookStage />
      <PageDetails evidence={<PageStyleCard />} open />
    </Shell>
  );
}

/**
 * Stylesheet evidence that keeps or releases an entry. The canonical changed
 * document shows every per-file outcome; the child pages hold the screen
 * states, at most five each.
 */
export const reviewStyleDesign = folder({
  title: "Stylesheet evidence",
  children: [
    screen({
      colorSchemes: ["light"],
      description:
        "A changed document opened from Changes, with no comparison controls. Details name each changed stylesheet once, with the styles that apply to the page, the styles that also apply outside the changed components, and a change that can apply anywhere on the page.",
      desktop: <PageStyles viewport="desktop" />,
      id: "design-review-style-page",
      mobile: <PageStyles viewport="mobile" />,
      rationale:
        "A document is read whole and never compared, so Details are the only place to show why it is in Changes. Each file keeps its own outcomes, and the sentences say page, so the evidence reads the same way as a screen's without suggesting a comparison.",
      title: "Document page styles",
    }),
    matchedExcludedDesigns,
    unresolvedUnnamedDesigns,
  ],
});
