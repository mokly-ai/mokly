import { useDarkPreview } from "../../parts/appearance.js";
import {
  DESTINATIONS,
  type DesignDestination,
} from "../../parts/destinations.js";
import { NAMING_GUIDE, WELCOME_SPECIFICATION } from "../../parts/docs.js";
import { NavDrawer, NavTree, type NavNode } from "../../parts/nav.js";
import { PreviousVersionLabel } from "../../parts/removed_preview.js";
import { ScreenHead, Shell, type ArtboardViewport } from "../../parts/shell.js";
import { DocumentPane, Stage } from "../../parts/stage.js";

import { NamingGuide, WelcomeSpecification } from "./content.js";
import { DocDetails, RemovedDocDetails } from "./details.js";

/** The branch removed one doc, so Changes holds that doc alone. */
const REMOVED_DOC_ROWS: readonly NavNode[] = [
  {
    key: `${NAMING_GUIDE.id}-removed`,
    depth: 0,
    kind: "doc",
    label: `${NAMING_GUIDE.title} · Removed`,
    to: DESTINATIONS.docRemoved,
  },
];

/** The doc row is selected in the canonical catalogue tree. */
const DOC_TREE = {
  activeDestination: DESTINATIONS.doc,
  changedCount: REMOVED_DOC_ROWS.length,
} as const;

/**
 * A current doc in the plain document pane. A doc has one reading layout, so
 * the head band carries no viewport control and the stage holds no device
 * frame; the view follows the catalogue's appearance like any screen.
 */
function DocShell({
  design,
  details = false,
  drawer = false,
  viewport,
}: {
  design: DesignDestination;
  details?: boolean;
  drawer?: boolean;
  viewport: ArtboardViewport;
}) {
  const dark = useDarkPreview();
  const doc = WELCOME_SPECIFICATION;
  return (
    <Shell
      design={design}
      viewport={viewport}
      nav={<NavTree {...DOC_TREE} />}
      aside={
        viewport === "mobile" && drawer ? <NavDrawer {...DOC_TREE} /> : null
      }
    >
      <ScreenHead
        comparisons={false}
        crumbs={doc.location}
        idChip={doc.id}
        title={doc.title}
      />
      <Stage>
        <DocumentPane>
          <WelcomeSpecification dark={dark} welcome={DESTINATIONS.welcome} />
        </DocumentPane>
      </Stage>
      <DocDetails open={details} />
    </Shell>
  );
}

/** `design-doc-view`: the doc in its folder with Details closed. */
export function DocViewScreen({ viewport }: { viewport: ArtboardViewport }) {
  return <DocShell design={DESTINATIONS.doc} viewport={viewport} />;
}

/** `design-doc-details`: the same doc with its Details open. */
export function DocDetailsScreen({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <DocShell design={DESTINATIONS.docDetails} details viewport={viewport} />
  );
}

/**
 * `design-doc-navigation`: the narrow drawer open on the doc row. The wide
 * layout keeps its persistent navigation with the same row selected.
 */
export function DocNavigationScreen({
  viewport,
}: {
  viewport: ArtboardViewport;
}) {
  return (
    <DocShell design={DESTINATIONS.docNavigation} drawer viewport={viewport} />
  );
}

/**
 * `design-doc-removed`: a removed doc opens its previous version from a flat
 * Changes row, under the folders the baseline recorded. Only its light view
 * was captured, so a dark catalogue keeps that light view and says so.
 */
export function RemovedDocScreen({ viewport }: { viewport: ArtboardViewport }) {
  const dark = useDarkPreview();
  const doc = NAMING_GUIDE;
  return (
    <Shell
      design={DESTINATIONS.docRemoved}
      viewport={viewport}
      nav={
        <NavTree
          activeDestination={DESTINATIONS.docRemoved}
          changedOnly
          changedCount={REMOVED_DOC_ROWS.length}
          nodes={REMOVED_DOC_ROWS}
        />
      }
    >
      <ScreenHead
        comparisons={false}
        crumbs={doc.location}
        idChip={doc.id}
        status="removed"
        title={doc.title}
      />
      <PreviousVersionLabel lightOnly={dark} />
      <Stage>
        <DocumentPane>
          <NamingGuide />
        </DocumentPane>
      </Stage>
      <RemovedDocDetails />
    </Shell>
  );
}
