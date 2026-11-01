import { defineScreen } from "@mokly/mokly";

import { PreviewLoading } from "../../../../../../../packages/ui/src/preview-state/preview-state.js";
import { designMetadata } from "../../../metadata.js";
import { artboards } from "../../../parts/artboards.js";
import { DESTINATIONS } from "../../../parts/destinations.js";
import { RemovedFieldGuide } from "../../../parts/removed_documents.js";
import {
  REMOVED_DOCUMENTS,
  RemovedPageScreen,
} from "../../../parts/removed_page.js";
import { PreviewUnavailable } from "../../../parts/removed_preview.js";
import type { ArtboardViewport } from "../../../parts/shell.js";

function LongDocument({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <RemovedPageScreen
      document={<RemovedFieldGuide />}
      entry={REMOVED_DOCUMENTS.fieldGuide}
      viewport={viewport}
    />
  );
}

function Loading({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <RemovedPageScreen
      entry={REMOVED_DOCUMENTS.printingTips}
      state={<PreviewLoading />}
      viewport={viewport}
    />
  );
}

function Unavailable({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <RemovedPageScreen
      entry={REMOVED_DOCUMENTS.styleNotes}
      state={<PreviewUnavailable to={DESTINATIONS.pageRemoved} />}
      viewport={viewport}
    />
  );
}

/** Previous-version states a removed document reaches before it can be read. */
export const longScreen = defineScreen({
  ...designMetadata,
  colorSchemes: ["light"],
  description:
    "A long previous document scrolls inside its pane, keeping its section headings addressable.",
  ...artboards({
    desktop: <LongDocument viewport="desktop" />,
    mobile: <LongDocument viewport="mobile" />,
  }),
  slug: "long",
  rationale:
    "Reading a removed document means moving through it, so the pane keeps the document's own scrolling and its headings stay reachable from the section list instead of being flattened into a preview image.",
  title: "Long previous document",
});
export const loadingScreen = defineScreen({
  ...designMetadata,
  colorSchemes: ["light"],
  description:
    "Selecting a removed document shows a loading stage until its previous version arrives.",
  ...artboards({
    desktop: <Loading viewport="desktop" />,
    mobile: <Loading viewport="mobile" />,
  }),
  slug: "loading",
  rationale:
    "The previous version is retrieved only when the document is opened, so the stage names the wait while the navigation, badge, and details stay in place.",
  title: "Loading previous document",
});
export const unavailableScreen = defineScreen({
  ...designMetadata,
  colorSchemes: ["light"],
  description:
    "A previous version that could not be loaded offers Retry and keeps the catalogue usable.",
  ...artboards({
    desktop: <Unavailable viewport="desktop" />,
    mobile: <Unavailable viewport="mobile" />,
  }),
  slug: "unavailable",
  rationale:
    "Nothing current may stand in for missing history, so the stage says plainly that the previous version is unavailable and offers one repeatable action rather than naming a reason.",
  title: "Previous document unavailable",
});
