import { defineScreen } from "@mokly/mokly";

import { changesDesignMetadata } from "./metadata.js";
import { DESTINATIONS } from "./parts/destinations.js";
import {
  HandbookStage,
  PAGE_STYLE_COUNT,
  PAGE_STYLE_ROWS,
  PageDetails,
} from "./parts/document_page.js";
import { ENTRY_PATHS } from "./parts/entry_paths.js";
import { NavTree } from "./parts/nav.js";
import { PageStyleCard } from "./parts/review.js";
import { ScreenHead, Shell, type ArtboardViewport } from "./parts/shell.js";

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
        path={ENTRY_PATHS.gettingStarted}
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
export const reviewStyleScreens = [
  defineScreen({
    ...changesDesignMetadata,
    colorSchemes: ["light"],
    description:
      "A changed document opened from Changes, with no comparison controls. Details name each changed stylesheet once, with the styles that apply to the page, the styles that also apply outside the changed components, and a change that can apply anywhere on the page.",
    desktop: <PageStyles viewport="desktop" />,
    slug: "page",
    mobile: <PageStyles viewport="mobile" />,
    rationale:
      "A document is read whole and never compared, so Details are the only place to show why it is in Changes. Each file keeps its own outcomes, and the sentences say page, so the evidence reads the same way as a screen's without suggesting a comparison.",
    title: "Document page styles",
  }),
];
