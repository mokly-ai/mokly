import { screen } from "@mokly/mokly";

import { ExampleDocument } from "../document.js";

import { DESTINATIONS } from "./parts/destinations.js";
import {
  HandbookStage,
  PAGE_NODES,
  PAGE_STYLE_COUNT,
  PageDetails,
} from "./parts/document_page.js";
import { NavDrawer, NavTree } from "./parts/nav.js";
import { REMOVED_DOCUMENTS, RemovedPageScreen } from "./parts/removed_page.js";
import { ScreenHead, Shell, type ArtboardViewport } from "./parts/shell.js";

function PageView({
  viewport,
  details = false,
  drawer = false,
}: {
  viewport: ArtboardViewport;
  details?: boolean;
  drawer?: boolean;
}) {
  const nav = (
    <NavTree
      activeLabel="Getting started"
      changedCount={PAGE_STYLE_COUNT}
      nodes={PAGE_NODES}
    />
  );
  return (
    <Shell
      design={
        drawer
          ? DESTINATIONS.pageNavigation
          : details
            ? DESTINATIONS.pageDetails
            : DESTINATIONS.page
      }
      viewport={viewport}
      nav={nav}
      aside={
        viewport === "mobile" && drawer ? (
          <NavDrawer
            activeLabel="Getting started"
            changedCount={PAGE_STYLE_COUNT}
            nodes={PAGE_NODES}
          />
        ) : null
      }
    >
      <ScreenHead
        comparisons={false}
        crumbs={["Example"]}
        idChip="example-handbook"
        title="Getting started"
      />
      <HandbookStage />
      <PageDetails open={details} />
    </Shell>
  );
}

function PageDesktop() {
  return <PageView viewport="desktop" />;
}
function PageMobile() {
  return <PageView viewport="mobile" />;
}
function PageDetailsDesktop() {
  return <PageView viewport="desktop" details />;
}
function PageDetailsMobile() {
  return <PageView viewport="mobile" details />;
}
function PageNavigationDesktop() {
  return <PageView viewport="desktop" drawer />;
}
function PageNavigationMobile() {
  return <PageView viewport="mobile" drawer />;
}

/** The previous version of the removed handbook, rendered read-only. */
function RemovedPageView({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <RemovedPageScreen
      document={<ExampleDocument readOnly />}
      entry={REMOVED_DOCUMENTS.handbook}
      viewport={viewport}
    />
  );
}

/** Owning responsive page designs, shared before runtime presentation. */
export const pageScreens = [
  screen({
    id: "design-page-view",
    title: "Document page",
    description: "A whole document beside screens and flows in one hierarchy.",
    colorSchemes: ["light"],
    desktop: <PageDesktop />,
    mobile: <PageMobile />,
  }),
  screen({
    id: "design-page-details",
    title: "Document details",
    description: "Page metadata and the narrow catalogue drawer.",
    colorSchemes: ["light"],
    desktop: <PageDetailsDesktop />,
    mobile: <PageDetailsMobile />,
  }),
  screen({
    id: "design-page-navigation",
    title: "Document navigation",
    description:
      "A document in its declared folder, with the narrow catalogue drawer.",
    colorSchemes: ["light"],
    desktop: <PageNavigationDesktop />,
    mobile: <PageNavigationMobile />,
  }),
  screen({
    id: "design-page-removed",
    title: "Removed document",
    description:
      "A removed document opens its previous version, keeping its flat Changes row and baseline ancestry.",
    rationale:
      "Deleting a document should not hide what it said. The previous version is the only readable copy left, so the stage shows it read-only under a quiet label instead of an empty state, while the Removed badge and the ancestry of the deleted parent stay in place.",
    colorSchemes: ["light"],
    desktop: <RemovedPageView viewport="desktop" />,
    mobile: <RemovedPageView viewport="mobile" />,
  }),
];
