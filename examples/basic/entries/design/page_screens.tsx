import { screen } from "@mokly/mokly";

import { ExampleDocument } from "../document.js";

import { useDesignNavigation } from "./parts/design_navigation.js";
import { DESTINATIONS } from "./parts/destinations.js";
import { DetailsPanel } from "./parts/details.js";
import { MetaRow } from "./parts/metadata_row.js";
import { NavDrawer, NavTree, type NavNode } from "./parts/nav.js";
import { REMOVED_DOCUMENTS, RemovedPageScreen } from "./parts/removed_page.js";
import { ScreenHead, Shell, type ArtboardViewport } from "./parts/shell.js";
import { DocumentPane, Stage } from "./parts/stage.js";

const nodes: readonly NavNode[] = [
  {
    key: "example",
    kind: "folder",
    label: "Example",
    count: 3,
    depth: 0,
    open: true,
  },
  {
    key: "welcome",
    kind: "screen",
    label: "Welcome",
    depth: 1,
    to: DESTINATIONS.welcome,
  },
  {
    key: "tour",
    kind: "flow",
    label: "Example tour",
    depth: 1,
    to: DESTINATIONS.tour,
  },
  {
    key: "handbook",
    kind: "page",
    label: "Getting started",
    depth: 1,
    to: DESTINATIONS.page,
  },
];

function PageDetails({ open = false }: { open?: boolean }) {
  const navigation = useDesignNavigation();
  return (
    <DetailsPanel open={open} destination={navigation.inspector}>
      <div className="mbk-details-body">
        <div>
          <p className="mbk-details-desc">
            A handbook to accompany the example screens.
          </p>
        </div>
        <div className="mbk-meta">
          <MetaRow name="source" label="Source">
            <code className="mbk-code">entries/catalogue.mockup.tsx</code>
          </MetaRow>
          <MetaRow name="generated" label="Generated">
            <code className="mbk-code">handbook.html</code>
          </MetaRow>
          <MetaRow name="tags" label="Tags">
            documents
          </MetaRow>
          <MetaRow name="related-docs" label="Related docs">
            Example notes
          </MetaRow>
        </div>
      </div>
    </DetailsPanel>
  );
}

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
    <NavTree activeLabel="Getting started" changedCount={1} nodes={nodes} />
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
            changedCount={1}
            nodes={nodes}
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
      <Stage>
        <DocumentPane>
          <ExampleDocument welcomeId={DESTINATIONS.welcome} />
        </DocumentPane>
      </Stage>
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
    slug: "view",
    colorSchemes: ["light"],
    desktop: <PageDesktop />,
    mobile: <PageMobile />,
  }),
  screen({
    id: "design-page-details",
    title: "Document details",
    description: "Page metadata and the narrow catalogue drawer.",
    slug: "details",
    colorSchemes: ["light"],
    desktop: <PageDetailsDesktop />,
    mobile: <PageDetailsMobile />,
  }),
  screen({
    id: "design-page-navigation",
    title: "Document navigation",
    description:
      "A document in its declared folder, with the narrow catalogue drawer.",
    slug: "navigation",
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
    slug: "removed",
    colorSchemes: ["light"],
    desktop: <RemovedPageView viewport="desktop" />,
    mobile: <RemovedPageView viewport="mobile" />,
  }),
];
