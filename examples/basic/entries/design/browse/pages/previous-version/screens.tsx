import { screen } from "@mokly/mokly";

import { DESTINATIONS } from "../../../parts/destinations.js";
import { RemovedFieldGuide } from "../../../parts/removed_documents.js";
import {
  REMOVED_DOCUMENTS,
  RemovedPageScreen,
} from "../../../parts/removed_page.js";
import {
  PreviewLoading,
  PreviewUnavailable,
} from "../../../parts/removed_preview.js";
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
export const removedPageScreens = [
  screen({
    colorSchemes: ["light"],
    description:
      "A long previous document scrolls inside its pane, keeping its section headings addressable.",
    desktop: <LongDocument viewport="desktop" />,
    id: "design-page-removed-long",
    mobile: <LongDocument viewport="mobile" />,
    rationale:
      "Reading a removed document means moving through it, so the pane keeps the document's own scrolling and its headings stay reachable from the section list instead of being flattened into a preview image.",
    slug: "long-document",
    title: "Long previous document",
  }),
  screen({
    colorSchemes: ["light"],
    description:
      "Selecting a removed document shows a loading stage until its previous version arrives.",
    desktop: <Loading viewport="desktop" />,
    id: "design-page-removed-loading",
    mobile: <Loading viewport="mobile" />,
    rationale:
      "The previous version is retrieved only when the document is opened, so the stage names the wait while the navigation, badge, and details stay in place.",
    slug: "loading",
    title: "Loading previous document",
  }),
  screen({
    colorSchemes: ["light"],
    description:
      "A previous version that could not be loaded offers Retry and keeps the catalogue usable.",
    desktop: <Unavailable viewport="desktop" />,
    id: "design-page-removed-unavailable",
    mobile: <Unavailable viewport="mobile" />,
    rationale:
      "Nothing current may stand in for missing history, so the stage says plainly that the previous version is unavailable and offers one repeatable action rather than naming a reason.",
    slug: "unavailable",
    title: "Previous document unavailable",
  }),
];
